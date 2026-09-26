import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { isStaffRole, parseStaffApplicationDetails } from '@/app/lib/staff-application-form';
import {
  STAFF_RESUME_BUCKET,
  STAFF_APPLICATION_MAX_BODY_BYTES,
  buildResumeStorageKey,
  validateResumeUpload,
} from '@/app/lib/staff-resume';
import { createServiceClient } from '@/app/lib/supabase/service';
import { rateLimit, getClientIp } from '@/app/lib/rate-limit';

// 5 submissions per IP per 10 minutes — consistent with general apply limit
const APPLY_LIMIT = 5;
const APPLY_WINDOW_MS = 10 * 60_000;

const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 });

/**
 * Public staff application intake. Accepts multipart/form-data: the applicant
 * fields, a `details` JSON string, and a required `resume` PDF.
 *
 * Every check runs before anything is written, and the resume is uploaded
 * only after the rest of the submission has passed, so a rejected request
 * never leaves an orphaned PII file in storage.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(ip, APPLY_LIMIT, APPLY_WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetInMs / 1000)) } },
    );
  }

  // Refuse oversized bodies from the declared length before buffering them.
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > STAFF_APPLICATION_MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Your resume is too large. Please upload a smaller PDF.' }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest('Invalid submission.');
  }

  const field = (key: string) => {
    const v = form.get(key);
    return typeof v === 'string' ? v.trim() : '';
  };
  const name = field('name');
  const preferredFirstName = field('preferredFirstName');
  const email = field('email');
  const phone = field('phone');
  const discordTag = field('discordTag');
  const role = field('role');

  if (!name || !email || !phone || !role) return badRequest('Missing required fields');
  if (!isStaffRole(role)) return badRequest('Invalid role');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest('Invalid email address');

  // `details` is unauthenticated JSON; the parser rebuilds it from known keys
  // and enforces every step-4 consent/acknowledgement strictly `=== true`.
  let rawDetails: unknown;
  try {
    rawDetails = JSON.parse(field('details') || 'null');
  } catch {
    return badRequest('Invalid application details.');
  }
  const parsed = parseStaffApplicationDetails(rawDetails);
  if (!parsed.ok) return badRequest(parsed.error);

  const resume = form.get('resume');
  if (!(resume instanceof File)) return badRequest('Please attach your resume as a PDF.');
  const bytes = new Uint8Array(await resume.arrayBuffer());
  const resumeError = validateResumeUpload(resume, bytes);
  if (resumeError) return badRequest(resumeError);

  const storage = createServiceClient().storage.from(STAFF_RESUME_BUCKET);
  const resumeStorageKey = buildResumeStorageKey(randomUUID());

  const { error: uploadError } = await storage.upload(resumeStorageKey, bytes, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (uploadError) {
    console.error('Failed to store staff application resume:', uploadError.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  try {
    await db.insert(schema.staffApplications).values({
      name,
      preferredFirstName,
      email,
      phone,
      discordTag,
      role,
      details: parsed.details,
      resumeStorageKey,
    });
  } catch (error) {
    console.error('Failed to save staff application:', error);
    // Without a row nothing references the file, so remove it rather than
    // keep an unowned resume around.
    const { error: cleanupError } = await storage.remove([resumeStorageKey]);
    if (cleanupError) console.error('Failed to remove orphaned resume:', cleanupError.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
