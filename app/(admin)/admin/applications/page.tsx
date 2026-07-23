import Card from '@/app/components/ui/Card';
import Link from 'next/link';
import { getSchoolApplications, getStaffApplications } from '@/app/lib/db/queries';
import ApplicationRow from '@/app/components/admin/ApplicationRow';
import StaffApplicationRow from '@/app/components/admin/StaffApplicationRow';
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';
import PermissionDenied from '@/app/components/admin/PermissionDenied';
import { getStaffForAdminSection } from '@/app/lib/auth';

type StatusFilter = 'all' | 'pending' | 'reviewed' | 'accepted';

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'All',
  pending: 'Pending',
  reviewed: 'Reviewed',
  accepted: 'Accepted',
};

const VALID_STATUSES: StatusFilter[] = ['all', 'pending', 'reviewed', 'accepted'];

function parseStatusFilter(raw: string | undefined): StatusFilter {
  return VALID_STATUSES.includes(raw as StatusFilter) ? (raw as StatusFilter) : 'all';
}

export default async function ApplicationsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; staffStatus?: string }>;
}) {
  if (!(await getStaffForAdminSection('/admin/applications'))) return <PermissionDenied />;

  const { status: rawStatus, staffStatus: rawStaffStatus } = await searchParams;
  const statusFilter = parseStatusFilter(rawStatus);
  const staffStatusFilter = parseStatusFilter(rawStaffStatus);
  const queryStatus = statusFilter === 'all' ? undefined : statusFilter;
  const staffQueryStatus = staffStatusFilter === 'all' ? undefined : staffStatusFilter;

  let applications: Awaited<ReturnType<typeof getSchoolApplications>> = [];
  let staffApplications: Awaited<ReturnType<typeof getStaffApplications>> = [];
  let dbConfigured = false;

  try {
    if (process.env.DATABASE_URL) {
      [applications, staffApplications] = await Promise.all([
        getSchoolApplications(queryStatus),
        getStaffApplications(staffQueryStatus),
      ]);
      dbConfigured = true;
    }
  } catch {
    // db not reachable
  }

  const schoolFilterHref = (s: StatusFilter) => {
    const params = new URLSearchParams();
    if (s !== 'all') params.set('status', s);
    if (staffStatusFilter !== 'all') params.set('staffStatus', staffStatusFilter);
    const qs = params.toString();
    return qs ? `/admin/applications?${qs}` : '/admin/applications';
  };

  const staffFilterHref = (s: StatusFilter) => {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (s !== 'all') params.set('staffStatus', s);
    const qs = params.toString();
    return qs ? `/admin/applications?${qs}` : '/admin/applications';
  };

  return (
    <div className="space-y-8">
      {!dbConfigured && <DbErrorNotice />}

      <Card className="bg-surface-raised/30 border border-line border-l-4 border-l-accent">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <h2 className="text-lg font-black text-white uppercase tracking-wider">
            School Applications
            {dbConfigured && (
              <span className="ml-2 text-foreground-secondary font-normal text-sm">({applications.length})</span>
            )}
          </h2>

          {/* Status filter tabs */}
          <div className="flex items-center gap-1 flex-wrap">
            {VALID_STATUSES.map((s) => (
              <Link
                key={s}
                href={schoolFilterHref(s)}
                scroll={false}
                className={`text-[10px] font-bold px-3 py-1.5 rounded-lg capitalize transition-all border ${
                  statusFilter === s
                    ? 'bg-accent/10 text-white border-accent/40'
                    : 'bg-surface-raised text-foreground-secondary border-line hover:text-white hover:border-line'
                }`}
              >
                {STATUS_LABELS[s]}
              </Link>
            ))}
          </div>
        </div>

        {applications.length === 0 ? (
          <p className="text-foreground-secondary text-sm">
            {statusFilter === 'all' ? 'No applications yet.' : `No ${statusFilter} applications.`}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-accent/20">
                  <th className="text-left text-xs font-bold text-foreground-secondary uppercase tracking-wider pb-3 pr-4">Applicant</th>
                  <th className="text-left text-xs font-bold text-foreground-secondary uppercase tracking-wider pb-3 pr-4">School</th>
                  <th className="text-left text-xs font-bold text-foreground-secondary uppercase tracking-wider pb-3 pr-4">Role</th>
                  <th className="text-left text-xs font-bold text-foreground-secondary uppercase tracking-wider pb-3 pr-4">Email</th>
                  <th className="text-left text-xs font-bold text-foreground-secondary uppercase tracking-wider pb-3 pr-4">Message</th>
                  <th className="text-left text-xs font-bold text-foreground-secondary uppercase tracking-wider pb-3 pr-4">Status</th>
                  <th className="text-left text-xs font-bold text-foreground-secondary uppercase tracking-wider pb-3">Submitted</th>
                  <th className="text-left text-xs font-bold text-foreground-secondary uppercase tracking-wider pb-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {applications.map((app) => (
                  <ApplicationRow key={app.id} app={app} activeFilter={statusFilter} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="bg-surface-raised/30 border border-line border-l-4 border-l-accent">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <h2 className="text-lg font-black text-white uppercase tracking-wider">
            Staff Applications
            {dbConfigured && (
              <span className="ml-2 text-foreground-secondary font-normal text-sm">({staffApplications.length})</span>
            )}
          </h2>

          {/* Status filter tabs */}
          <div className="flex items-center gap-1 flex-wrap">
            {VALID_STATUSES.map((s) => (
              <Link
                key={s}
                href={staffFilterHref(s)}
                scroll={false}
                className={`text-[10px] font-bold px-3 py-1.5 rounded-lg capitalize transition-all border ${
                  staffStatusFilter === s
                    ? 'bg-accent/10 text-white border-accent/40'
                    : 'bg-surface-raised text-foreground-secondary border-line hover:text-white hover:border-line'
                }`}
              >
                {STATUS_LABELS[s]}
              </Link>
            ))}
          </div>
        </div>

        {staffApplications.length === 0 ? (
          <p className="text-foreground-secondary text-sm">
            {staffStatusFilter === 'all' ? 'No applications yet.' : `No ${staffStatusFilter} applications.`}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-accent/20">
                  <th className="text-left text-xs font-bold text-foreground-secondary uppercase tracking-wider pb-3 pr-4">Applicant</th>
                  <th className="text-left text-xs font-bold text-foreground-secondary uppercase tracking-wider pb-3 pr-4">Role</th>
                  <th className="text-left text-xs font-bold text-foreground-secondary uppercase tracking-wider pb-3 pr-4">Email</th>
                  <th className="text-left text-xs font-bold text-foreground-secondary uppercase tracking-wider pb-3 pr-4">Phone</th>
                  <th className="text-left text-xs font-bold text-foreground-secondary uppercase tracking-wider pb-3 pr-4">Message</th>
                  <th className="text-left text-xs font-bold text-foreground-secondary uppercase tracking-wider pb-3 pr-4">Status</th>
                  <th className="text-left text-xs font-bold text-foreground-secondary uppercase tracking-wider pb-3">Submitted</th>
                  <th className="text-left text-xs font-bold text-foreground-secondary uppercase tracking-wider pb-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {staffApplications.map((app) => (
                  <StaffApplicationRow key={app.id} app={app} activeFilter={staffStatusFilter} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
