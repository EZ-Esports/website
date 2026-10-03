import {
  countPendingResults,
  countPublishedNews,
  countScheduledMatches,
  countTeamsWithoutRoster,
  getCachedGames,
  getCachedTeams,
} from '@/app/lib/db/queries';
import { getStaff } from '@/app/lib/auth';
import { hasPermission, Permissions } from '@/app/lib/roles';
import { getAllowedAdminHrefs, hasAnyManagementPermission } from '@/app/lib/staff-access';
import { filterAdminNav } from '@/app/lib/admin-nav';
import AdminControlPanel from '@/app/components/admin/AdminControlPanel';
import { AdminNotice, AdminPage, AdminPageHeader } from '@/app/components/admin/AdminUI';
import { cardHover, secondaryBtn, secondaryBtnSm } from '@/app/components/admin/styles';
import Link from 'next/link';
import {
  HiArrowRight,
  HiArrowTopRightOnSquare,
  HiOutlineCalendarDays,
  HiOutlineNewspaper,
  HiOutlineTrophy,
  HiOutlineUsers,
} from 'react-icons/hi2';

export default async function AdminDashboardPage() {
  const staff = await getStaff();
  if (!staff) return null;

  const canLeague = hasPermission(staff.permissions, staff.isOwner, Permissions.MANAGE_LEAGUE);
  const canMatches = hasPermission(staff.permissions, staff.isOwner, Permissions.MANAGE_MATCHES);
  const canRosters = hasPermission(staff.permissions, staff.isOwner, Permissions.MANAGE_ROSTERS);
  const canNews = hasPermission(staff.permissions, staff.isOwner, Permissions.MANAGE_NEWS);

  if (!hasAnyManagementPermission(staff.permissions, staff.isOwner)) {
    return (
      <AdminPage>
        <OverviewHeader />
        <AdminNotice tone="warning" live="none" title="Awaiting role assignment" className="max-w-3xl">
          Your staff account is active and you will remain signed in. An Owner or staff member
          with role-management permission can assign your first role; refresh this page afterward
          to use the newly granted sections.
        </AdminNotice>
      </AdminPage>
    );
  }

  let stats = { games: 0, teams: 0, scheduledMatches: 0, publishedNews: 0 };
  let dbConfigured = false;
  let connectionError = '';
  let pendingResults = 0;
  let teamsWithNoRoster = 0;

  try {
    if (process.env.DATABASE_URL) {
      const [games, teams, scheduledMatches, publishedNews, pending, incompleteRosters] = await Promise.all([
        canLeague ? getCachedGames() : Promise.resolve([]),
        canRosters ? getCachedTeams() : Promise.resolve([]),
        canMatches ? countScheduledMatches() : Promise.resolve(0),
        canNews ? countPublishedNews() : Promise.resolve(0),
        canMatches ? countPendingResults() : Promise.resolve(0),
        canRosters ? countTeamsWithoutRoster() : Promise.resolve(0),
      ]);

      stats = {
        games: games.length,
        teams: teams.length,
        scheduledMatches,
        publishedNews,
      };
      pendingResults = pending;
      teamsWithNoRoster = incompleteRosters;
      dbConfigured = true;
    }
  } catch (error) {
    connectionError = error instanceof Error ? error.message : 'Database connection error';
  }

  // Same permission filter as the sidebar, so every link here opens a page the viewer can use.
  const controlPanel = filterAdminNav(getAllowedAdminHrefs(staff.permissions, staff.isOwner));

  const alerts = [
    ...(canMatches && pendingResults > 0 ? [{
      type: 'warning' as const,
      label: 'Pending Results',
      count: pendingResults,
      message: `${pendingResults} past ${pendingResults === 1 ? 'match still needs' : 'matches still need'} final scores.`,
      link: '/admin/matches',
      linkText: 'Enter Scores',
    }] : []),
    ...(canRosters && teamsWithNoRoster > 0 ? [{
      type: 'info' as const,
      label: 'Incomplete Teams',
      count: teamsWithNoRoster,
      message: `${teamsWithNoRoster} registered teams have no competitive rosters assigned.`,
      link: '/admin/roster',
      linkText: 'Assign Rosters',
    }] : []),
  ];

  return (
    <AdminPage className="space-y-8">
      <OverviewHeader />

      {alerts.length > 0 && (
        <div className="admin-stagger grid grid-cols-1 gap-3 md:grid-cols-2">
          {alerts.map((alert) => (
            <AdminNotice
              key={alert.label}
              tone={alert.type}
              live="none"
              title={`${alert.label} (${alert.count})`}
              action={
                <Link href={alert.link} className={secondaryBtnSm}>
                  {alert.linkText}
                </Link>
              }
            >
              {alert.message}
            </AdminNotice>
          ))}
        </div>
      )}

      {!dbConfigured && (
        <AdminNotice tone="warning" live="none" title="Database connection required">
          <p>Configure <code className="rounded bg-surface-sunken px-1 py-0.5 font-mono text-[0.8125rem] text-foreground">DATABASE_URL</code> before loading management data.</p>
          {connectionError && <p className="mt-2 rounded-lg bg-surface-sunken p-3 font-mono text-xs text-warning">{connectionError}</p>}
        </AdminNotice>
      )}

      <section aria-label="At a glance" className="admin-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {canLeague && <StatCard href="/admin/league" label="Competition games" value={dbConfigured ? stats.games : 'N/A'} icon={<HiOutlineTrophy className="h-5 w-5" />} />}
        {canRosters && <StatCard href="/admin/roster" label="Registered teams" value={dbConfigured ? stats.teams : 'N/A'} icon={<HiOutlineUsers className="h-5 w-5" />} />}
        {canMatches && <StatCard href="/admin/matches" label="Scheduled matches" value={dbConfigured ? stats.scheduledMatches : 'N/A'} icon={<HiOutlineCalendarDays className="h-5 w-5" />} />}
        {canNews && <StatCard href="/admin/news" label="Published articles" value={dbConfigured ? stats.publishedNews : 'N/A'} icon={<HiOutlineNewspaper className="h-5 w-5" />} />}
      </section>

      <AdminControlPanel categories={controlPanel} />
    </AdminPage>
  );
}

function OverviewHeader() {
  return (
    <AdminPageHeader
      eyebrow="Staff Portal"
      title={<>Welcome to <span className="text-accent">EZ</span> Staff</>}
      description="Your portal access follows your effective staff roles and permissions."
      actions={
        <Link href="/" className={secondaryBtn}>
          View public website
          <HiArrowTopRightOnSquare aria-hidden className="h-4 w-4" />
        </Link>
      }
    />
  );
}

/** A count that doubles as a shortcut into its section. Lifts slightly on hover. */
function StatCard({ href, label, value, icon }: { href: string; label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`group flex h-32 flex-col justify-between rounded-2xl bg-admin-panel p-5 ${cardHover} outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface`}
    >
      <div className="flex items-center justify-between text-sm font-medium text-foreground-secondary">
        <span>{label}</span>
        <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">{icon}</span>
      </div>
      <div className="flex items-end justify-between">
        <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
        <HiArrowRight
          aria-hidden
          className="mb-1 h-4 w-4 -translate-x-1 text-accent opacity-0 transition-[opacity,translate] duration-200 group-hover:translate-x-0 group-hover:opacity-100 motion-reduce:transition-none"
        />
      </div>
    </Link>
  );
}
