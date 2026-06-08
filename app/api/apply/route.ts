import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';

export async function POST(request: NextRequest) {
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
