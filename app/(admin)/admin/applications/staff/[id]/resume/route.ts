import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { getStaffForAdminSection } from '@/app/lib/auth';
import { createServiceClient } from '@/app/lib/supabase/service';
import { RESUME_SIGNED_URL_TTL_SECONDS, STAFF_RESUME_BUCKET } from '@/app/lib/staff-resume';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const noStore = { 'Cache-Control': 'private, no-store' };

/**
 * Opens a staff applicant's resume. Gated exactly like the Applications
 * review page, then redirects to a short-lived signed URL for the private
 * bucket, so the admin UI can use a plain link and no long-lived URL to the
 * file is ever stored or rendered.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getStaffForAdminSection('/admin/applications'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: noStore });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: noStore });
  }

  const [row] = await db
    .select({ resumeStorageKey: schema.staffApplications.resumeStorageKey })
    .from(schema.staffApplications)
    .where(and(eq(schema.staffApplications.id, id), isNull(schema.staffApplications.deletedAt)))
    .limit(1);

  if (!row?.resumeStorageKey) {
    return NextResponse.json({ error: 'No resume on file for this application.' }, { status: 404, headers: noStore });
  }

  const { data, error } = await createServiceClient()
    .storage.from(STAFF_RESUME_BUCKET)
    .createSignedUrl(row.resumeStorageKey, RESUME_SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.error('Failed to sign staff resume URL:', error?.message);
    return NextResponse.json({ error: 'Could not open the resume. Please try again.' }, { status: 502, headers: noStore });
  }

  return NextResponse.redirect(data.signedUrl, { status: 303, headers: noStore });
}
