'use client';

import { useState, useTransition } from 'react';
import Card from '@/app/components/ui/Card';
import InviteAdminForm from '@/app/components/admin/InviteAdminForm';
import { canActOnMember, Permissions, parseHexColor } from '@/app/lib/roles';
import AdminRow from '@/app/components/admin/AdminRow';
import InviteRow from '@/app/components/admin/InviteRow';
import {
  createRole,
  updateRole,
  deleteRole,
  reorderRoles,
  updateUserRoles,
} from '@/app/(admin)/admin/team/actions';
import {
  HiOutlineChevronUp,
  HiOutlineChevronDown,
  HiOutlineTrash,
  HiOutlinePencilSquare,
  HiOutlinePlus,
  HiOutlineShieldCheck,
  HiOutlineUsers,
  HiOutlineXMark,
} from 'react-icons/hi2';

interface Role {
  id: string;
  name: string;
  color: string;
  permissions: string; // string-serialized BigInt
  position: number;
  isOwner: boolean;
  isSystem: boolean;
}

interface AdminUser {
  userId: string;
  email: string;
  createdAt: Date;
  roles: {
    id: string;
    name: string;
    color: string;
    permissions: string;
    position: number;
    isOwner: boolean;
  }[];
}

interface PendingInvite {
  id: string;
  email: string;
  expiresAt: Date;
  expired: boolean;
  roles: {
    id: string;
    name: string;
    color: string;
    position: number;
  }[];
}

interface TeamManagerClientProps {
  current: {
    id: string;
    email: string | undefined;
    permissions: string; // string-serialized BigInt
    isOwner: boolean;
    highestRolePosition: number;
  };
  admins: AdminUser[];
  invites: PendingInvite[];
  roles: Role[];
}

const PRESET_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#d946ef', // Fuchsia
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#94a3b8', // Slate
];

const PERMISSION_GROUPS = [
  {
    title: 'General Administration',
    permissions: [
      { bit: Permissions.ADMINISTRATOR, name: 'Administrator', desc: 'Grants all permissions and bypasses all validation checks.' },
      { bit: Permissions.MANAGE_ROLES, name: 'Manage Roles & Staff', desc: 'Create, edit, delete, and reorder roles, and assign roles to staff.' },
      { bit: Permissions.MANAGE_APPLICATIONS, name: 'Manage Applications', desc: 'Review, accept, or reject new school league applications.' },
      { bit: Permissions.MANAGE_SCHOOLS, name: 'Manage Schools', desc: 'Register and update active schools within the league.' },
    ],
  },
  {
    title: 'League & Match Configuration',
    permissions: [
      { bit: Permissions.MANAGE_LEAGUE, name: 'Manage League Config', desc: 'Create, edit, and delete games, seasons, and school teams.' },
      { bit: Permissions.MANAGE_ROSTERS, name: 'Manage Rosters', desc: 'Manage game rosters and assign student players to them.' },
      { bit: Permissions.MANAGE_MATCHES, name: 'Manage Matches', desc: 'Schedule matches, enter/report match scores, and change match status.' },
    ],
  },
  {
    title: 'CMS & Content Management',
    permissions: [
      { bit: Permissions.MANAGE_NEWS, name: 'Manage News', desc: 'Create, edit, publish, and delete news posts and articles.' },
      { bit: Permissions.MANAGE_LEADERSHIP, name: 'Manage Leadership', desc: 'Manage leadership board listings and details.' },
      { bit: Permissions.MANAGE_GALLERY, name: 'Manage Gallery', desc: 'Upload, arrange, caption, and delete public gallery images.' },
      { bit: Permissions.MANAGE_SPONSORS, name: 'Manage Sponsors', desc: 'Create, edit, arrange, and delete sponsors and sponsorship tiers.' },
      { bit: Permissions.MANAGE_CONTENT, name: 'Manage CMS Content', desc: 'Modify editable text blocks across public pages.' },
    ],
  },
];

const PERMISSION_LABELS = PERMISSION_GROUPS.flatMap((g) => g.permissions);

export default function TeamManagerClient({ current, admins, invites, roles }: TeamManagerClientProps) {
  const [activeTab, setActiveTab] = useState<'staff' | 'roles'>('staff');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [editingUser, setEditingUser] = useState<{ userId: string; email: string; currentRoleIds: string[] } | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isCreatingRole, setIsCreatingRole] = useState(false);

  // Permissions helpers
  const currentPermissions = BigInt(current.permissions);
  const currentIsOwner = current.isOwner;

  // Filter assignable roles: strictly lower than actor's highest role, and actor must possess their permissions
  const assignableRoles = roles.filter((role) => {
    if (currentIsOwner) return true;
    const isLower = current.highestRolePosition > role.position;
    const hasSubset = (BigInt(role.permissions) & ~currentPermissions) === BigInt(0);
    return isLower && hasSubset;
  });

  // Check if current user can manage a target role
  function canActorManageRole(rolePosition: number) {
    if (currentIsOwner) return true;
    return current.highestRolePosition > rolePosition;
  }

  // Handle User Roles edit
  function handleSaveUserRoles(formData: FormData) {
    if (!editingUser) return;
    setError(null);
    const selectedRoleIds = formData.getAll('userRoleIds') as string[];

    startTransition(async () => {
      const result = await updateUserRoles(editingUser.userId, selectedRoleIds);
      if (!result.success) {
        setError(result.error ?? 'Could not update user roles.');
        return;
      }
      setEditingUser(null);
    });
  }

  // Handle Create Role
  function handleCreateRoleSubmit(formData: FormData) {
    setError(null);
    // Calculate permissions bitmask from selected checkboxes
    let permissionsBitmask = 0n;
    PERMISSION_LABELS.forEach((label) => {
      if (formData.get(`perm_${label.bit.toString()}`)) {
        permissionsBitmask |= label.bit;
      }
    });

    const bodyData = new FormData();
    bodyData.append('name', formData.get('name') as string);
    bodyData.append('color', formData.get('color') as string);
    bodyData.append('permissions', permissionsBitmask.toString());

    startTransition(async () => {
      const result = await createRole(bodyData);
      if (!result.success) {
        setError(result.error ?? 'Could not create role.');
        return;
      }
      setIsCreatingRole(false);
    });
  }

  // Handle Edit Role
  function handleEditRoleSubmit(formData: FormData) {
    if (!editingRole) return;
    setError(null);

    let permissionsBitmask = 0n;
    PERMISSION_LABELS.forEach((label) => {
      if (formData.get(`perm_${label.bit.toString()}`)) {
        permissionsBitmask |= label.bit;
      }
    });

    const bodyData = new FormData();
    bodyData.append('name', formData.get('name') as string);
    bodyData.append('color', formData.get('color') as string);
    bodyData.append('permissions', permissionsBitmask.toString());

    startTransition(async () => {
      const result = await updateRole(editingRole.id, bodyData);
      if (!result.success) {
        setError(result.error ?? 'Could not update role.');
        return;
      }
      setEditingRole(null);
    });
  }

  // Handle Delete Role
  function handleDeleteRole(roleId: string) {
    if (!window.confirm('Are you sure you want to delete this role? This action cannot be undone and will strip the role from all users.')) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteRole(roleId);
      if (!result.success) {
        setError(result.error ?? 'Could not delete role.');
        return;
      }
      setEditingRole(null);
    });
  }

  // Handle Reorder Roles
  function handleMoveRole(roleIndex: number, direction: 'up' | 'down') {
    setError(null);
    // roles array is sorted from highest position to lowest.
    // Filter out Owner and @everyone which cannot be reordered.
    const reorderableRoles = roles.filter((r) => !r.isOwner && r.name !== '@everyone');
    
    // Find index in reorderable array
    const targetId = roles[roleIndex].id;
    const rIndex = reorderableRoles.findIndex((r) => r.id === targetId);
    if (rIndex === -1) return;

    const swapIndex = direction === 'up' ? rIndex - 1 : rIndex + 1;
    if (swapIndex < 0 || swapIndex >= reorderableRoles.length) return;

    const newOrder = [...reorderableRoles];
    const temp = newOrder[rIndex];
    newOrder[rIndex] = newOrder[swapIndex];
    newOrder[swapIndex] = temp;

    // The reorderRoles API expects array elements in ascending position order (lowest to highest position).
    // Our reorderableRoles array is in descending position (highest to lowest position), so we reverse it.
    const orderedIdsAsc = newOrder.map((r) => r.id).reverse();

    startTransition(async () => {
      const result = await reorderRoles(orderedIdsAsc);
      if (!result.success) {
        setError(result.error ?? 'Could not reorder roles.');
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Tabs Menu */}
      <div className="flex border-b border-zinc-800 pb-px">
        <button
          onClick={() => { setActiveTab('staff'); setError(null); }}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm tracking-wide border-b-2 cursor-pointer transition-all duration-300 ${
            activeTab === 'staff'
              ? 'border-ez-pink text-white font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <HiOutlineUsers className="w-4 h-4" />
          <span>Staff Members</span>
        </button>
        <button
          onClick={() => { setActiveTab('roles'); setError(null); }}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm tracking-wide border-b-2 cursor-pointer transition-all duration-300 ${
            activeTab === 'roles'
              ? 'border-ez-pink text-white font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <HiOutlineShieldCheck className="w-4 h-4" />
          <span>Roles Manager</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-4 py-3 rounded-lg flex justify-between items-center" role="alert">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 cursor-pointer">
            <HiOutlineXMark className="w-5 h-5" />
          </button>
        </div>
      )}

      {activeTab === 'staff' && (
        <div className="space-y-8">
          {/* Invite staff */}
          <Card className="bg-slate-900/10 border border-zinc-800 border-l-4 border-l-ez-pink p-6">
            <h2 className="text-lg font-black text-white uppercase tracking-wider mb-1">Invite Staff Member</h2>
            <p className="text-xs text-slate-400 mb-5">
              Generates a single-use onboarding invitation link. Copy and send it to the new staff member manually.
            </p>
            <InviteAdminForm assignableRoles={assignableRoles} />
          </Card>

          {/* Active staff */}
          <Card className="bg-slate-900/10 border border-zinc-800 p-6">
            <h2 className="text-lg font-black text-white uppercase tracking-wider mb-5">
              Staff Directory
              <span className="ml-2 text-slate-500 font-normal text-sm">({admins.length})</span>
            </h2>
            {admins.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/10">
                <HiOutlineUsers className="w-8 h-8 text-slate-500 mx-auto mb-2.5 opacity-60" />
                <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-1">No staff members found</p>
                <p className="text-zinc-500 text-xs font-medium">Use the form above to invite your first league moderator or administrator.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800/80">
                      <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3 pr-4">Email</th>
                      <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3 pr-4">Roles</th>
                      <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3 pr-4">Added</th>
                      <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-850">
                    {admins.map((a) => {
                      // Determine if actor can manage target based on highest position
                      const targetHighestPos = a.roles.reduce((max, r) => (r.position > max ? r.position : max), 0);
                      const targetIsOwner = a.roles.some((r) => r.isOwner);
                      const canManage = canActOnMember(current.highestRolePosition, currentIsOwner, targetHighestPos, targetIsOwner);

                      return (
                        <AdminRow
                          key={a.userId}
                          admin={{ userId: a.userId, email: a.email, roles: a.roles, createdAt: a.createdAt }}
                          isSelf={a.userId === current.id}
                          canRevoke={canManage}
                          onEditRoles={(userId, email, currentRoleIds) => setEditingUser({ userId, email, currentRoleIds })}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Pending invites */}
          <Card className="bg-slate-900/10 border border-zinc-800 p-6">
            <h2 className="text-lg font-black text-white uppercase tracking-wider mb-5">
              Pending Onboardings
              <span className="ml-2 text-slate-500 font-normal text-sm">({invites.length})</span>
            </h2>
            {invites.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/10">
                <HiOutlineShieldCheck className="w-8 h-8 text-slate-500 mx-auto mb-2.5 opacity-60" />
                <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-1">No pending onboardings</p>
                <p className="text-zinc-500 text-xs font-medium">All sent invitations have been successfully claimed or expired.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800/80">
                      <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3 pr-4">Email</th>
                      <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3 pr-4">Pre-assigned Roles</th>
                      <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3 pr-4">Expires</th>
                      <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-850">
                    {invites.map((inv) => {
                      const targetHighestPos = inv.roles.reduce((max, r) => (r.position > max ? r.position : max), 0);
                      const canManage = canActorManageRole(targetHighestPos);

                      return (
                        <InviteRow
                          key={inv.id}
                          invite={{ id: inv.id, email: inv.email, roles: inv.roles, expiresAt: inv.expiresAt }}
                          expired={inv.expired}
                          canRevoke={canManage}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-wider">Role Hierarchy</h2>
              <p className="text-xs text-slate-400">
                Manage customized roles. Drag or click arrows to sort hierarchy rank (higher positions override lower ones).
              </p>
            </div>
            <button
              onClick={() => setIsCreatingRole(true)}
              className="flex items-center gap-2 px-4 py-2 bg-ez-pink hover:bg-ez-pink/80 text-ez-black font-semibold text-xs uppercase tracking-wider rounded-lg shadow-lg hover:shadow-ez-pink/20 transition-all cursor-pointer"
            >
              <HiOutlinePlus className="w-4 h-4" />
              <span>Create Role</span>
            </button>
          </div>

          <Card className="bg-slate-900/10 border border-zinc-800 p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800/80">
                    <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3 pr-4">Rank Order</th>
                    <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3 pr-4">Role Name</th>
                    <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3 pr-4">Key Permissions</th>
                    <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850">
                  {roles.map((role, idx) => {
                    const isSystem = role.isSystem;
                    const canEdit = canActorManageRole(role.position);
                    const numPerms = PERMISSION_LABELS.filter((l) => (BigInt(role.permissions) & l.bit) !== BigInt(0)).length;

                    // Filter reorderability: cannot move Owner, @everyone, or any role equal to/higher than actor position
                    const isReorderable = !role.isOwner && role.name !== '@everyone' && canActorManageRole(role.position);
                    const parsedColor = parseHexColor(role.color);

                    return (
                      <tr key={role.id} className="hover:bg-zinc-900/20 transition-colors">
                        <td className="py-4 pr-4">
                          {isReorderable ? (
                            <div className="flex items-center gap-1">
                              <button
                                disabled={idx === 0 || isPending || !roles[idx - 1] || roles[idx - 1].isOwner || !canActorManageRole(roles[idx - 1].position)}
                                onClick={() => handleMoveRole(idx, 'up')}
                                className="p-1 hover:bg-zinc-800 rounded text-slate-400 hover:text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                title="Move Up"
                              >
                                <HiOutlineChevronUp className="w-4 h-4" />
                              </button>
                              <button
                                disabled={idx === roles.length - 1 || isPending || !roles[idx + 1] || roles[idx + 1].name === '@everyone' || !canActorManageRole(roles[idx + 1].position)}
                                onClick={() => handleMoveRole(idx, 'down')}
                                className="p-1 hover:bg-zinc-800 rounded text-slate-400 hover:text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                title="Move Down"
                              >
                                <HiOutlineChevronDown className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-zinc-600 italic text-xs pl-3">Locked</span>
                          )}
                        </td>
                        <td className="py-4 pr-4 font-semibold whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span
                              className="px-2.5 py-1 rounded text-xs font-extrabold uppercase tracking-wider"
                              style={{
                                backgroundColor: `${parsedColor}12`,
                                color: parsedColor,
                                border: `1px solid ${parsedColor}25`,
                              }}
                            >
                              {role.name}
                            </span>
                            {role.isOwner && (
                              <span className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/25 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider select-none">
                                System Owner
                              </span>
                            )}
                            {role.name === '@everyone' && (
                              <span className="text-[9px] bg-zinc-800 text-zinc-400 border border-zinc-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider select-none">
                                Everyone
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 pr-4 text-slate-400 text-xs">
                          {role.isOwner ? (
                            <span className="text-red-400 font-bold uppercase tracking-wider">All Permissions</span>
                          ) : numPerms === 0 ? (
                            <span className="text-zinc-600 italic">None</span>
                          ) : (
                            <span>{numPerms} permission(s) granted</span>
                          )}
                        </td>
                        <td className="py-4">
                          {canEdit ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setEditingRole(role)}
                                className="p-1.5 hover:bg-zinc-800 rounded text-slate-300 hover:text-white transition-all cursor-pointer border border-zinc-800"
                                title="Configure Role"
                              >
                                <HiOutlinePencilSquare className="w-4 h-4" />
                              </button>
                              {!isSystem && (
                                <button
                                  onClick={() => handleDeleteRole(role.id)}
                                  className="p-1.5 hover:bg-red-950/20 hover:text-red-400 rounded text-slate-400 hover:border-red-900/40 transition-all cursor-pointer border border-zinc-800"
                                  title="Delete Role"
                                >
                                  <HiOutlineTrash className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-zinc-600 italic text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: Edit User Roles */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center">
              <h3 className="text-base font-black text-white uppercase tracking-wider">Edit Roles for {editingUser.email}</h3>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <HiOutlineXMark className="w-5 h-5" />
              </button>
            </div>

            <form action={handleSaveUserRoles}>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <p className="text-xs text-slate-400 mb-4">
                  Select the roles you wish to assign to this member. You can only assign roles that rank below your highest role.
                </p>
                <div className="space-y-3">
                  {assignableRoles.map((role) => {
                    const isChecked = editingUser.currentRoleIds.includes(role.id);
                    const parsedColor = parseHexColor(role.color);
                    return (
                      <label
                        key={role.id}
                        className="flex items-center justify-between p-3 bg-zinc-950/30 hover:bg-zinc-900/40 border border-zinc-800 rounded-lg cursor-pointer transition-all select-none"
                      >
                        <span
                          className="text-xs font-extrabold px-2.5 py-1 rounded uppercase tracking-wider"
                          style={{
                            backgroundColor: `${parsedColor}12`,
                            color: parsedColor,
                            border: `1px solid ${parsedColor}25`,
                          }}
                        >
                          {role.name}
                        </span>
                        <input
                          type="checkbox"
                          name="userRoleIds"
                          value={role.id}
                          defaultChecked={isChecked}
                          className="rounded text-ez-pink focus:ring-ez-pink bg-zinc-950 border-zinc-800 cursor-pointer w-5 h-5"
                        />
                      </label>
                    );
                  })}
                  {assignableRoles.length === 0 && (
                    <div className="text-center py-6 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/10">
                      <HiOutlineShieldCheck className="w-6 h-6 text-slate-500 mx-auto mb-2 opacity-50" />
                      <p className="text-xs text-zinc-500 italic">No assignable roles available below your hierarchy rank.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 border-t border-zinc-800 flex justify-end gap-3 bg-zinc-950/20">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 border border-zinc-850 hover:border-zinc-750 text-slate-400 hover:text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 bg-ez-pink hover:bg-ez-pink/80 text-ez-black font-extrabold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Create Role */}
      {isCreatingRole && (
        <RoleMutateModal
          title="Create New Role"
          isOwner={currentIsOwner}
          actorPermissions={currentPermissions}
          onClose={() => setIsCreatingRole(false)}
          onSave={handleCreateRoleSubmit}
          isPending={isPending}
        />
      )}

      {/* MODAL: Edit Role */}
      {editingRole && (
        <RoleMutateModal
          title={`Configure Role: ${editingRole.name}`}
          role={editingRole}
          isOwner={currentIsOwner}
          actorPermissions={currentPermissions}
          onClose={() => setEditingRole(null)}
          onSave={handleEditRoleSubmit}
          onDelete={editingRole.isSystem ? undefined : () => handleDeleteRole(editingRole.id)}
          isPending={isPending}
        />
      )}
    </div>
  );
}

/* Internal helper sub-component for creating/editing roles */
interface RoleMutateModalProps {
  title: string;
  role?: Role;
  isOwner: boolean;
  actorPermissions: bigint;
  onClose: () => void;
  onSave: (formData: FormData) => void;
  onDelete?: () => void;
  isPending: boolean;
}

function RoleMutateModal({ title, role, isOwner, actorPermissions, onClose, onSave, onDelete, isPending }: RoleMutateModalProps) {
  const [selectedColor, setSelectedColor] = useState(parseHexColor(role?.color ?? '#94a3b8'));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#18181b] border border-zinc-800 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center">
          <h3 className="text-base font-black text-white uppercase tracking-wider">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <HiOutlineXMark className="w-5 h-5" />
          </button>
        </div>

        <form action={onSave}>
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto font-sans">
            {/* Row 1: Name and Color */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="role-name" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Role Name
                </label>
                <input
                  id="role-name"
                  name="name"
                  type="text"
                  required
                  disabled={role?.isSystem}
                  defaultValue={role?.name}
                  placeholder="e.g. Moderator"
                  className="w-full px-4 py-2.5 bg-background border border-zinc-800 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ez-pink focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Badge Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    name="color"
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    className="w-12 h-[42px] bg-background border border-zinc-800 rounded-lg cursor-pointer p-1"
                  />
                  <div className="flex-1 flex flex-wrap gap-1.5 items-center bg-zinc-950/20 px-2.5 py-1.5 border border-zinc-850 rounded-lg">
                    {PRESET_COLORS.map((c) => {
                      const isActive = selectedColor.toLowerCase() === c.toLowerCase();
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setSelectedColor(c)}
                          className={`w-4 h-4 rounded-full transition-all cursor-pointer hover:scale-125 ${
                            isActive
                              ? 'ring-2 ring-white ring-offset-2 ring-offset-[#18181b] scale-110'
                              : 'border border-black/30 hover:border-white/50'
                          }`}
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: Permissions Toggles */}
            <div className="space-y-4">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                Role Permissions
              </label>

              {role?.isOwner ? (
                <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-xs px-4 py-3 rounded-lg font-sans">
                  This is the system Owner role. It automatically grants all permissions and bypasses all constraints. Its permissions cannot be modified.
                </div>
              ) : (
                <div className="space-y-6">
                  {PERMISSION_GROUPS.map((group) => (
                    <div key={group.title} className="space-y-3 p-4 bg-zinc-950/20 border border-zinc-900 rounded-xl">
                      <h4 className="text-xs font-black text-white uppercase tracking-wider border-b border-zinc-800 pb-1.5 flex items-center gap-2 select-none">
                        <span className="w-1 h-3.5 bg-ez-pink rounded" />
                        <span>{group.title}</span>
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {group.permissions.map((label) => {
                          const hasPerm = role ? (BigInt(role.permissions) & label.bit) !== BigInt(0) : false;
                          
                          // Disable checkbox if the current actor does not possess this permission (preventing escalation)
                          const isActorMissing = !isOwner && (actorPermissions & label.bit) === BigInt(0);

                          return (
                            <div
                              key={label.bit.toString()}
                              className={`flex items-start gap-3 p-3 bg-zinc-950/30 border rounded-lg transition-all select-none ${
                                isActorMissing
                                  ? 'opacity-40 border-zinc-850 cursor-not-allowed'
                                  : 'border-zinc-800 hover:border-zinc-700/80 cursor-pointer'
                              }`}
                            >
                              <input
                                id={`perm_${label.bit.toString()}`}
                                name={`perm_${label.bit.toString()}`}
                                type="checkbox"
                                value="true"
                                defaultChecked={hasPerm}
                                disabled={isActorMissing}
                                className="rounded text-ez-pink focus:ring-ez-pink focus:ring-offset-0 bg-zinc-950 border-zinc-800 cursor-pointer disabled:cursor-not-allowed w-4 h-4 mt-0.5 shrink-0"
                              />
                              <div className="flex flex-col">
                                <label
                                  htmlFor={`perm_${label.bit.toString()}`}
                                  className={`text-xs font-extrabold uppercase tracking-wide cursor-pointer ${
                                    isActorMissing ? 'text-slate-500 cursor-not-allowed' : 'text-slate-200'
                                  }`}
                                >
                                  {label.name}
                                </label>
                                <span className="text-[10px] text-slate-500 font-medium leading-relaxed mt-0.5">{label.desc}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-zinc-800 flex justify-between items-center bg-zinc-950/20">
            <div>
              {onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="px-4 py-2 border border-red-900/30 hover:border-red-900/60 bg-red-950/10 hover:bg-red-950/30 text-red-400 font-bold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                >
                  Delete Role
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-zinc-850 hover:border-zinc-750 text-slate-400 hover:text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-5 py-2 bg-ez-pink hover:bg-ez-pink/80 text-ez-black font-extrabold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

