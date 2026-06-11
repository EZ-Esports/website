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
    const { applicantName, schoolName, role, email, message } = body;

    if (!applicantName || !schoolName || !role || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    await db.insert(schema.schoolApplications).values({
      applicantName,
      schoolName,
      role,
      email,
      message: message ?? '',
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Failed to save school application:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
