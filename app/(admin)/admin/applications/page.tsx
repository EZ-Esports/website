import { HiOutlineAcademicCap, HiOutlineUserPlus } from "react-icons/hi2";
import { getSchoolApplications, getStaffApplications } from "@/app/lib/db/queries";
import ApplicationRow from "@/app/components/admin/ApplicationRow";
import StaffApplicationRow from "@/app/components/admin/StaffApplicationRow";
import ApplicationsTabs, { type ApplicationsTabKey } from "@/app/components/admin/ApplicationsTabs";
import ExportCsvButton from "@/app/components/admin/ExportCsvButton";
import DbErrorNotice from "@/app/components/admin/DbErrorNotice";
import PermissionDenied from "@/app/components/admin/PermissionDenied";
import { getStaffForAdminSection } from "@/app/lib/auth";
import {
  AdminEmptyState,
  AdminFilterTabs,
  AdminNotice,
  AdminPage,
  AdminPageHeader,
  AdminSection,
} from "@/app/components/admin/AdminUI";
import { ghostBtnSm, table, tableWrap, tbody, th, theadRow, thRight } from "@/app/components/admin/styles";
import Link from "next/link";
import { exportSchoolApplicationsCsv, exportStaffApplicationsCsv } from "./actions";

type StatusFilter = "all" | "pending" | "reviewed" | "accepted" | "rejected";

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All",
  pending: "Pending",
  reviewed: "Reviewed",
  accepted: "Accepted",
  rejected: "Rejected",
};

const VALID_STATUSES: StatusFilter[] = ["all", "pending", "reviewed", "accepted", "rejected"];

function parseStatusFilter(raw: string | undefined): StatusFilter {
  return VALID_STATUSES.includes(raw as StatusFilter) ? (raw as StatusFilter) : "all";
}

export default async function ApplicationsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; staffStatus?: string; posting?: string; tab?: string }>;
}) {
  if (!(await getStaffForAdminSection("/admin/applications"))) return <PermissionDenied />;

  const { status: rawStatus, staffStatus: rawStaffStatus, posting: postingId, tab: rawTab } = await searchParams;
  const statusFilter = parseStatusFilter(rawStatus);
  const staffStatusFilter = parseStatusFilter(rawStaffStatus);
  // A career-opening or staff-status deep link only makes sense on the staff tab.
  const defaultTab: ApplicationsTabKey =
    rawTab === "staff" || rawTab === "school"
      ? rawTab
      : postingId || rawStaffStatus
        ? "staff"
        : "school";
  const queryStatus = statusFilter === "all" ? undefined : statusFilter;
  const staffQueryStatus = staffStatusFilter === "all" ? undefined : staffStatusFilter;

  let applications: Awaited<ReturnType<typeof getSchoolApplications>> = [];
  let staffApplications: Awaited<ReturnType<typeof getStaffApplications>> = [];
  let dbConfigured = false;

  try {
    if (process.env.DATABASE_URL) {
      [applications, staffApplications] = await Promise.all([
        getSchoolApplications(queryStatus),
        getStaffApplications(staffQueryStatus, postingId),
      ]);
      dbConfigured = true;
    }
  } catch {
    // db not reachable
  }

  const schoolFilterHref = (s: StatusFilter) => {
    const params = new URLSearchParams();
    if (s !== "all") params.set("status", s);
    if (staffStatusFilter !== "all") params.set("staffStatus", staffStatusFilter);
    if (postingId) params.set("posting", postingId);
    params.set("tab", "school");
    const qs = params.toString();
    return qs ? `/admin/applications?${qs}` : "/admin/applications";
  };

  const staffFilterHref = (s: StatusFilter) => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (s !== "all") params.set("staffStatus", s);
    if (postingId) params.set("posting", postingId);
    params.set("tab", "staff");
    const qs = params.toString();
    return qs ? `/admin/applications?${qs}` : "/admin/applications";
  };

  const emptyTitle = (filter: StatusFilter) =>
    filter === "all" ? "No applications yet." : `No ${filter} applications.`;

  return (
    <AdminPage>
      <AdminPageHeader
        route="/admin/applications"
        description="Review school interest forms and staff applications, and move each one through its status."
      />

      {!dbConfigured && <DbErrorNotice />}

      <ApplicationsTabs
        defaultTab={defaultTab}
        schoolCount={dbConfigured ? applications.length : undefined}
        staffCount={dbConfigured ? staffApplications.length : undefined}
        school={
        <AdminSection
          id="school-applications"
          variant="flush"
          stickyToolbar
          title="School applications"
          actions={
            dbConfigured && applications.length > 0 ? (
              <ExportCsvButton
                action={exportSchoolApplicationsCsv}
                status={queryStatus}
                filename={`school-applications-${statusFilter}.csv`}
              />
            ) : undefined
          }
          toolbar={
            <AdminFilterTabs
              label="Filter school applications by status"
              items={VALID_STATUSES.map((s) => ({
                key: s,
                label: STATUS_LABELS[s],
                href: schoolFilterHref(s),
                active: statusFilter === s,
              }))}
            />
          }
        >
          {applications.length === 0 ? (
            <AdminEmptyState compact icon={<HiOutlineAcademicCap />} title={emptyTitle(statusFilter)} />
          ) : (
            <div className={tableWrap}>
              <table className={table}>
                <thead>
                  <tr className={theadRow}>
                    <th className={th}>Applicant</th>
                    <th className={th}>School</th>
                    <th className={th}>Role</th>
                    <th className={th}>Email</th>
                    <th className={th}>Details</th>
                    <th className={th}>Status</th>
                    <th className={th}>Submitted</th>
                    <th className={thRight}>Actions</th>
                  </tr>
                </thead>
                <tbody className={tbody}>
                  {applications.map((app) => (
                    <ApplicationRow key={app.id} app={app} activeFilter={statusFilter} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminSection>
        }
        staff={
        <AdminSection
          id="staff-applications"
          variant="flush"
          stickyToolbar
          title="Staff applications"
          actions={
            dbConfigured && staffApplications.length > 0 ? (
              <ExportCsvButton
                action={exportStaffApplicationsCsv}
                status={staffQueryStatus}
                filename={`staff-applications-${staffStatusFilter}.csv`}
              />
            ) : undefined
          }
          toolbar={
            <AdminFilterTabs
              label="Filter staff applications by status"
              items={VALID_STATUSES.map((s) => ({
                key: s,
                label: STATUS_LABELS[s],
                href: staffFilterHref(s),
                active: staffStatusFilter === s,
              }))}
            />
          }
        >
          {postingId && (
            <div className="px-5 pb-4">
              <AdminNotice
                tone="info"
                live="none"
                title="Filtered by a specific career opening"
                action={
                  <Link href={staffFilterHref(staffStatusFilter).replace(/[?&]posting=[^&]+/, "")} className={ghostBtnSm}>
                    Clear filter
                  </Link>
                }
              />
            </div>
          )}

          {staffApplications.length === 0 ? (
            <AdminEmptyState compact icon={<HiOutlineUserPlus />} title={emptyTitle(staffStatusFilter)} />
          ) : (
            <div className={tableWrap}>
              <table className={table}>
                <thead>
                  <tr className={theadRow}>
                    <th className={th}>Applicant</th>
                    <th className={th}>Role</th>
                    <th className={th}>Email</th>
                    <th className={th}>Phone</th>
                    <th className={th}>Details</th>
                    <th className={th}>Status</th>
                    <th className={th}>Submitted</th>
                    <th className={thRight}>Actions</th>
                  </tr>
                </thead>
                <tbody className={tbody}>
                  {staffApplications.map((app) => (
                    <StaffApplicationRow key={app.id} app={app} activeFilter={staffStatusFilter} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminSection>
        }
      />
    </AdminPage>
  );
}
