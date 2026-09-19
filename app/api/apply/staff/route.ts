import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { isStaffRole } from '@/app/lib/staff-application-form';
import { rateLimit, getClientIp } from '@/app/lib/rate-limit';

// 5 submissions per IP per 10 minutes — consistent with general apply limit
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
    const { name, preferredFirstName, email, phone, discordTag, role, details } = body;

    if (!name || !email || !phone || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!isStaffRole(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Legal consent (issue #107, mirroring the school form's issue #127 gate
    // in app/api/apply/route.ts) is the one check that has to hold server-side
    // even though `details` is otherwise unauthenticated JSON: every step is
    // optional-chained and strictly `=== true` rather than truthy, since a
    // missing/null `details` or a non-boolean value must fail closed instead
    // of throwing or passing.
    const consent = details?.consent;
    if (consent?.agreedToTerms !== true || consent?.agreedToPrivacy !== true) {
      return NextResponse.json(
        { error: 'You must agree to the Terms of Service and Privacy Policy to submit an application.' },
        { status: 400 },
      );
    }

    await db.insert(schema.staffApplications).values({
      name,
      preferredFirstName: preferredFirstName ?? '',
      email,
      phone,
      discordTag: discordTag ?? '',
      role,
      details: details && typeof details === 'object' && !Array.isArray(details) ? details : null,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Failed to save staff application:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
