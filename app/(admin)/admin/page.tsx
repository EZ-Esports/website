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
import { hasAnyManagementPermission } from '@/app/lib/staff-access';
import Link from 'next/link';
import Card from '@/app/components/ui/Card';
import Button from '@/app/components/ui/Button';
import {
  HiExclamationTriangle,
  HiInformationCircle,
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
      <div className="space-y-8">
        <WelcomeBanner />
        <Card className="border border-line border-l-4 border-l-amber-400 bg-surface-raised/30 p-8">
          <h2 className="text-xl font-black text-white">Awaiting role assignment</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground-secondary">
            Your staff account is active and you will remain signed in. An Owner or staff member
            with role-management permission can assign your first role; refresh this page afterward
            to use the newly granted sections.
          </p>
        </Card>
      </div>
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
    <div className="space-y-8">
      <WelcomeBanner />

      {alerts.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {alerts.map((alert) => (
            <div key={alert.label} className={`flex items-center justify-between rounded-xl border p-4 ${alert.type === 'warning' ? 'border-amber-500/20 bg-amber-500/5' : 'border-blue-500/20 bg-blue-500/5'}`}>
              <div className="flex items-center gap-4">
                {alert.type === 'warning'
                  ? <HiExclamationTriangle className="h-5 w-5 text-amber-500" />
                  : <HiInformationCircle className="h-5 w-5 text-blue-500" />}
                <div>
                  <h4 className="text-sm font-bold text-white">{alert.label} ({alert.count})</h4>
                  <p className="mt-0.5 text-xs text-foreground-secondary">{alert.message}</p>
                </div>
              </div>
              <Button href={alert.link} variant="secondary" className="h-auto shrink-0 px-3 py-1 text-[10px]">{alert.linkText}</Button>
            </div>
          ))}
        </div>
      )}

      {!dbConfigured && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-6">
          <div className="flex items-start gap-4">
            <HiExclamationTriangle className="mt-0.5 h-7 w-7 shrink-0 text-amber-400" />
            <div>
              <h3 className="text-lg font-bold text-amber-400">Database Connection Required</h3>
              <p className="mt-1 text-sm text-foreground-secondary">Configure <code>DATABASE_URL</code> before loading management data.</p>
              {connectionError && <p className="mt-3 rounded-lg bg-black/60 p-3 font-mono text-xs text-amber-500">{connectionError}</p>}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {canLeague && <StatCard href="/admin/league" label="Competition Games" value={dbConfigured ? stats.games : 'N/A'} icon={<HiOutlineTrophy className="h-6 w-6" />} />}
        {canRosters && <StatCard href="/admin/roster" label="Registered Teams" value={dbConfigured ? stats.teams : 'N/A'} icon={<HiOutlineUsers className="h-6 w-6" />} />}
        {canMatches && <StatCard href="/admin/matches" label="Scheduled Matches" value={dbConfigured ? stats.scheduledMatches : 'N/A'} icon={<HiOutlineCalendarDays className="h-6 w-6" />} />}
        {canNews && <StatCard href="/admin/news" label="Published Articles" value={dbConfigured ? stats.publishedNews : 'N/A'} icon={<HiOutlineNewspaper className="h-6 w-6" />} />}
      </div>

      {(canMatches || canNews || canRosters) && (
        <Card className="duration-300 hover:border-line/80 hover:shadow-none">
          <h3 className="mb-6 text-lg font-black uppercase tracking-wider text-white">Quick Actions</h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {canMatches && <QuickAction href="/admin/matches" title="Create Match Event" description="Schedule matches, input results, and manage varsity matchups." />}
            {canNews && <QuickAction href="/admin/news" title="Write Announcement" description="Publish news, tournament notifications, and club updates." />}
            {canRosters && <QuickAction href="/admin/roster" title="Roster Management" description="Assign student captains, roster lists, and player profiles." />}
          </div>
        </Card>
      )}
    </div>
  );
}

function WelcomeBanner() {
  return (
    <Card className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-l-4 border-line border-l-accent bg-surface-raised/30 p-8 shadow-none md:flex-row md:items-center">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-white">Welcome to <span className="text-accent">EZ</span> Staff</h1>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-foreground-secondary">Your portal access follows your effective staff roles and permissions.</p>
      </div>
      <Button href="/" variant="primary" className="shrink-0">View Public Website</Button>
    </Card>
  );
}

function StatCard({ href, label, value, icon }: { href: string; label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <Link href={href}>
      <Card className="flex h-36 cursor-pointer flex-col justify-between duration-300 hover:scale-[1.03]">
        <div className="flex items-center justify-between text-sm font-bold uppercase tracking-wider text-foreground-secondary">
          <span>{label}</span>
          <span className="rounded-lg border border-accent/20 bg-accent/10 p-1.5 text-accent">{icon}</span>
        </div>
        <p className="text-4xl font-black text-white">{value}</p>
      </Card>
    </Link>
  );
}

function QuickAction({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-line/80 bg-[#1a1a1a]/80 p-6">
      <div>
        <h4 className="font-extrabold text-white">{title}</h4>
        <p className="mt-2 text-xs leading-relaxed text-foreground-secondary">{description}</p>
      </div>
      <Link href={href} className="text-xs font-bold uppercase tracking-wider text-foreground-secondary hover:text-accent">Open manager →</Link>
    </div>
  );
}
