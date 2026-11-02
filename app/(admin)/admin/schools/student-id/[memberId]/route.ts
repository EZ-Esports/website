import { NextRequest, NextResponse } from 'next/server';
import { getStaffWithPermission } from '@/app/lib/auth';
import { ADMIN_ROSTER_VIEW_PERMISSION } from '@/app/lib/staff-access';
import { Permissions } from '@/app/lib/roles';
import { db } from '@/app/lib/db';
import { staffAuditLogs } from '@/app/lib/db/schema';
import { findStudentIdKeyForMember } from '@/app/lib/db/student-ids';
import { isLocalStudentIdStorage, readLocalStudentId, signStudentIdUrl } from '@/app/lib/onboarding/student-id-storage';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Never cached by the browser, a CDN or Next: every open re-checks the viewer and mints a new link.
const noStore = { 'Cache-Control': 'private, no-store' };

/**
 * Opens a member's student ID photo for staff (spec-056). Allowed for the staff who can see the roster
 * pages that link here (roster view or school management). The route looks the object key up itself,
 * so a caller cannot name an object, and redirects to a signed URL that expires within minutes. No
 * signed URL is ever rendered into a page, cached, or exported.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const staff =
    (await getStaffWithPermission(ADMIN_ROSTER_VIEW_PERMISSION)) ??
    (await getStaffWithPermission(Permissions.MANAGE_SCHOOLS));
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: noStore });

  const { memberId } = await params;
  if (!UUID_RE.test(memberId)) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: noStore });

  const key = await findStudentIdKeyForMember(memberId);
  if (!key) {
    return NextResponse.json({ error: 'No student ID on file for this member.' }, { status: 404, headers: noStore });
  }

  // Dev-only local driver: there is no URL to sign, so serve the verified bytes directly (same auth and
  // audit as below). Production never takes this branch.
  if (isLocalStudentIdStorage()) {
    const stored = await readLocalStudentId(key);
    if (!stored) {
      return NextResponse.json({ error: 'The stored student ID file is missing.' }, { status: 404, headers: noStore });
    }
    await recordView(staff, memberId);
    return new NextResponse(stored.bytes as BodyInit, {
      status: 200,
      headers: {
        ...noStore,
        'Content-Type': stored.contentType,
        'Content-Disposition': 'inline; filename="student-id"',
        'X-Content-Type-Options': 'nosniff',
        // User-supplied bytes: forbid any script, frame or subresource if the browser renders them as a document.
        'Content-Security-Policy': "default-src 'none'; img-src 'self'; sandbox",
      },
    });
  }

  const signedUrl = await signStudentIdUrl(key);
  if (!signedUrl) {
    return NextResponse.json({ error: 'Could not open the student ID. Please try again.' }, { status: 502, headers: noStore });
  }

  await recordView(staff, memberId);

  return NextResponse.redirect(signedUrl, { status: 303, headers: noStore });
}

/** Who looked at a minor's ID is worth knowing. Best effort: an audit failure never blocks staff. */
async function recordView(staff: { id: string; email: string }, memberId: string) {
  try {
    await db.insert(staffAuditLogs).values({
      event: 'student_id_viewed',
      userId: staff.id,
      email: staff.email,
      details: `member ${memberId}`,
    });
  } catch (err) {
    console.error('Could not record student ID view:', err instanceof Error ? err.message : 'unexpected error');
  }
}
