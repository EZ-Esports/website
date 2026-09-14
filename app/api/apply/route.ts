import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { rateLimit, getClientIp } from '@/app/lib/rate-limit';
import { validateSchoolApplicationForm, compileApplicationPayload, type SchoolApplicationFormData } from '@/app/lib/school-application-form';

// 5 submissions per IP per 10 minutes — generous enough for legitimate use,
// strict enough to prevent spam flooding the applications inbox.
const APPLY_LIMIT = 5;
const APPLY_WINDOW_MS = 10 * 60_000;

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(ip, APPLY_LIMIT, APPLY_WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetInMs / 1000)) } },
    );
  }

  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // Honeypot: a real applicant never sees or fills this field (visually
    // hidden off-screen in ApplyForm.tsx, not merely `display:none`, and kept
    // out of the tab order). A bot that fills every input on the page trips
    // it. Respond as if the submission succeeded — a hard rejection just
    // teaches the bot which field to skip — but never persist the row.
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      console.warn('Rejected school application: honeypot field was filled', { ip });
      return NextResponse.json({ success: true }, { status: 201 });
    }

    // The client and server must agree on what's required. Rather than
    // re-implement the same checks against a different shape (and risk them
    // drifting apart), the route validates and compiles the raw form data
    // with the exact same shared functions ApplyForm.tsx uses client-side —
    // the client-side check is strictly a UX nicety, this is the real gate.
    const { website: _honeypot, ...formData } = body;
    const errors = validateSchoolApplicationForm(formData as SchoolApplicationFormData);
    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ error: 'Missing or invalid required fields', fieldErrors: errors }, { status: 400 });
    }

    const { applicantName, schoolName, role, email, message, details } = compileApplicationPayload(formData as SchoolApplicationFormData);

    await db.insert(schema.schoolApplications).values({
      applicantName,
      schoolName,
      role,
      email,
      message: message ?? '',
      details: details && typeof details === 'object' && !Array.isArray(details) ? details : null,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Failed to save school application:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
