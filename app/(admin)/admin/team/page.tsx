import Card from '@/app/components/ui/Card';
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';
import InviteAdminForm from '@/app/components/admin/InviteAdminForm';
import AdminRow from '@/app/components/admin/AdminRow';
import InviteRow from '@/app/components/admin/InviteRow';
import { getAdmin, isSuperAdmin } from '@/app/lib/auth';
import { listAdminUsers, listPendingAdminInvites } from '@/app/lib/db/queries';
import { INVITE_TTL_DAYS } from './constants';

export default async function TeamAdminPage() {
  const current = await getAdmin();

  let admins: Awaited<ReturnType<typeof listAdminUsers>> = [];
  let invites: Awaited<ReturnType<typeof listPendingAdminInvites>> = [];
  let dbConfigured = false;

  try {
    if (process.env.DATABASE_URL) {
      [admins, invites] = await Promise.all([listAdminUsers(), listPendingAdminInvites()]);
      dbConfigured = true;
    }
  } catch {
    // db not reachable
  }

  const isSuperAdminUser = current ? isSuperAdmin(current.role) : false;

  return (
    <div className="space-y-8">
      {!dbConfigured && <DbErrorNotice />}

      {/* Invite */}
      <Card className="bg-slate-900/30 border border-slate-800 border-l-4 border-l-ez-pink">
        <h2 className="text-lg font-black text-white uppercase tracking-wider mb-1">Invite an admin</h2>
        <p className="text-sm text-slate-400 mb-5">
          Generates a single-use link that expires in {INVITE_TTL_DAYS} days. Copy it and send it to the new admin
          yourself — they&apos;ll set a password and gain access.
        </p>
        <InviteAdminForm canGrantSuperAdmin={isSuperAdminUser} />
      </Card>

      {/* Current admins */}
      <Card className="bg-slate-900/30 border border-slate-800">
        <h2 className="text-lg font-black text-white uppercase tracking-wider mb-5">
          Admins
          {dbConfigured && <span className="ml-2 text-slate-400 font-normal text-sm">({admins.length})</span>}
        </h2>
        {admins.length === 0 ? (
          <p className="text-slate-400 text-sm">No admins yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ez-pink/20">
                  <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3 pr-4">Email</th>
                  <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3 pr-4">Role</th>
                  <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3 pr-4">Added</th>
                  <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {admins.map((a) => (
                  <AdminRow
                    key={a.userId}
                    admin={{ userId: a.userId, email: a.email, role: a.role, createdAt: a.createdAt }}
                    isSelf={a.userId === current?.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pending invites */}
      <Card className="bg-slate-900/30 border border-slate-800">
        <h2 className="text-lg font-black text-white uppercase tracking-wider mb-5">
          Pending invites
          {dbConfigured && <span className="ml-2 text-slate-400 font-normal text-sm">({invites.length})</span>}
        </h2>
        {invites.length === 0 ? (
          <p className="text-slate-400 text-sm">No pending invites.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ez-pink/20">
                  <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3 pr-4">Email</th>
                  <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3 pr-4">Role</th>
                  <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3 pr-4">Expires</th>
                  <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {invites.map((inv) => (
                  <InviteRow
                    key={inv.id}
                    invite={{ id: inv.id, email: inv.email, role: inv.role, expiresAt: inv.expiresAt }}
                    expired={inv.expired}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
