import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { rateLimit, getClientIp } from '@/app/lib/rate-limit';

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
    const { applicantName, schoolName, role, email, message, details } = body;

    if (!applicantName || !schoolName || !role || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Legal consent (issue #127) is the one gate that has to hold even though
    // the rest of the hand-rolled validation was reverted: `details` is
    // unauthenticated JSON, so every step here is optional-chained and
    // strictly `=== true` rather than truthy, since a missing/null `details`
    // or a non-boolean value must fail closed instead of throwing or passing.
    const consent = details?.consent;
    if (consent?.agreedToRules !== true || consent?.agreedToTerms !== true || consent?.agreedToPrivacy !== true) {
      return NextResponse.json(
        { error: 'You must agree to the league rules, Terms of Service, and Privacy Policy to submit an application.' },
        { status: 400 },
      );
    }

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
