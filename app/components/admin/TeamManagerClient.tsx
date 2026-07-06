'use client';

import { useState, useTransition } from 'react';
import Card from '@/app/components/ui/Card';
import InviteAdminForm from '@/app/components/admin/InviteAdminForm';
import { canActOnMember, Permissions, parseHexColor, hasPermission } from '@/app/lib/roles';
import AdminRow from '@/app/components/admin/AdminRow';
import InviteRow from '@/app/components/admin/InviteRow';
import {
  createRole,
  updateRole,
  deleteRole,
  reorderRoles,
} from '@/app/(admin)/admin/team/actions';
import {
  HiOutlineChevronUp,
  HiOutlineChevronDown,
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

  // Sub-tabs and filter state for Staff Members
  const [staffSubTab, setStaffSubTab] = useState<'members' | 'invites'>('members');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRoleId, setFilterRoleId] = useState('');
  
  // Discord Roles split-pane workspace state
  const [activeRoleId, setActiveRoleId] = useState<string | null>(null);
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [roleTab, setRoleTab] = useState<'display' | 'permissions'>('display');
  const [selectedColor, setSelectedColor] = useState('#94a3b8');

  const activeRole = roles.find((r) => r.id === activeRoleId) || null;

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
      setActiveRoleId(null);
    });
  }

  // Handle Edit Role
  function handleEditRoleSubmit(formData: FormData) {
    if (!activeRole) return;
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
      const result = await updateRole(activeRole.id, bodyData);
      if (!result.success) {
        setError(result.error ?? 'Could not update role.');
        return;
      }
      // Keep it active/selected
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
      setActiveRoleId(null);
      setIsCreatingRole(false);
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
        <div className="space-y-6">
          {/* Sub-tabs menu */}
          <div className="flex gap-4 border-b border-zinc-800/60 pb-px mb-2">
            <button
              onClick={() => { setStaffSubTab('members'); setError(null); }}
              className={`text-xs font-bold uppercase tracking-wider pb-2 border-b-2 transition-all cursor-pointer ${
                staffSubTab === 'members'
                  ? 'border-ez-pink text-white font-extrabold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Active Members ({admins.length})
            </button>
            <button
              onClick={() => { setStaffSubTab('invites'); setError(null); }}
              className={`text-xs font-bold uppercase tracking-wider pb-2 border-b-2 transition-all cursor-pointer ${
                staffSubTab === 'invites'
                  ? 'border-ez-pink text-white font-extrabold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Invites & Onboarding ({invites.length})
            </button>
          </div>

          {/* Sub-tab 1: Members Directory */}
          {staffSubTab === 'members' && (
            <div className="space-y-6">
              {/* Search & Filter Header */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                {/* Search input */}
                <div className="w-full sm:w-72 relative">
                  <input
                    type="text"
                    placeholder="Search by email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ez-pink focus:border-transparent transition-all placeholder-zinc-650"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-zinc-300"
                    >
                      <HiOutlineXMark className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Role filter dropdown */}
                <div className="w-full sm:w-56">
                  <select
                    value={filterRoleId}
                    onChange={(e) => setFilterRoleId(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-ez-pink focus:border-transparent transition-all cursor-pointer"
                  >
                    <option value="">All Roles</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Members List */}
              <div className="space-y-3">
                {(() => {
                  const filteredAdmins = admins.filter((admin) => {
                    const matchesSearch = admin.email.toLowerCase().includes(searchQuery.toLowerCase());
                    const matchesRole = filterRoleId ? admin.roles.some((r) => r.id === filterRoleId) : true;
                    return matchesSearch && matchesRole;
                  });

                  if (filteredAdmins.length === 0) {
                    return (
                      <div className="text-center py-10 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/10">
                        <HiOutlineUsers className="w-8 h-8 text-slate-500 mx-auto mb-2.5 opacity-60" />
                        <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-1">No staff members found</p>
                        <p className="text-zinc-500 text-xs font-medium">Try clearing your filters or search terms.</p>
                      </div>
                    );
                  }

                  return filteredAdmins.map((a) => {
                    const targetHighestPos = a.roles.reduce((max, r) => (r.position > max ? r.position : max), 0);
                    const targetIsOwner = a.roles.some((r) => r.isOwner);
                    const canManage = canActOnMember(current.highestRolePosition, currentIsOwner, targetHighestPos, targetIsOwner);

                    return (
                      <AdminRow
                        key={a.userId}
                        admin={{ userId: a.userId, email: a.email, roles: a.roles, createdAt: a.createdAt }}
                        isSelf={a.userId === current.id}
                        canRevoke={canManage}
                        assignableRoles={assignableRoles}
                      />
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* Sub-tab 2: Invites & Onboarding */}
          {staffSubTab === 'invites' && (
            <div className="space-y-6">
              {/* Action Card for new invite */}
              <Card className="bg-slate-900/10 border border-zinc-800 border-l-4 border-l-ez-pink p-6">
                <h2 className="text-base font-black text-white uppercase tracking-wider mb-1">Invite Staff Member</h2>
                <p className="text-xs text-slate-400 mb-5">
                  Generates a single-use onboarding invitation link. Copy and send it to the new staff member manually.
                </p>
                <InviteAdminForm assignableRoles={assignableRoles} />
              </Card>

              {/* Pending Invites List */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider px-1">
                  Pending Onboardings ({invites.length})
                </h3>
                {invites.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/10">
                    <HiOutlineShieldCheck className="w-8 h-8 text-slate-500 mx-auto mb-2.5 opacity-60" />
                    <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-1">No pending onboardings</p>
                    <p className="text-zinc-500 text-xs font-medium">All sent invitations have been successfully claimed or expired.</p>
                  </div>
                ) : (
                  invites.map((inv) => {
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
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-zinc-950/20 border border-zinc-800 rounded-xl min-h-[600px] overflow-hidden">
          {/* Left Pane: Role Directory Sidebar */}
          <div className="col-span-1 border-r border-zinc-800 p-4 space-y-4 bg-zinc-900/10 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-4 px-2">
                <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Roles</span>
                {(currentIsOwner || hasPermission(currentPermissions, currentIsOwner, Permissions.MANAGE_ROLES)) && (
                  <button
                    onClick={() => {
                      setIsCreatingRole(true);
                      setActiveRoleId(null);
                      setRoleTab('display');
                      setSelectedColor('#94a3b8');
                    }}
                    className="p-1 hover:bg-zinc-850 border border-transparent hover:border-zinc-800 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer"
                    title="Create Role"
                  >
                    <HiOutlinePlus className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="space-y-1 overflow-y-auto max-h-[500px] pr-1">
                {roles.map((role, idx) => {
                  const isActive = activeRoleId === role.id && !isCreatingRole;
                  const parsedColor = parseHexColor(role.color);
                  const isReorderable = !role.isOwner && role.name !== '@everyone' && canActorManageRole(role.position);

                  return (
                    <div
                      key={role.id}
                      onClick={() => {
                        setActiveRoleId(role.id);
                        setIsCreatingRole(false);
                        setRoleTab('display');
                        setSelectedColor(parsedColor);
                      }}
                      className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all select-none ${
                        isActive
                          ? 'bg-zinc-800/80 text-white shadow border border-zinc-700/50'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-zinc-900/30 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Colored Circle representing role color, matching Discord */}
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/40"
                          style={{ backgroundColor: parsedColor }}
                        />
                        <span className={`text-xs font-extrabold uppercase tracking-wide truncate ${isActive ? 'text-white' : ''}`}>
                          {role.name}
                        </span>
                      </div>

                      {/* Reordering Controls (subtle hover buttons like Discord) */}
                      {isReorderable ? (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            disabled={idx === 0 || isPending || !roles[idx - 1] || roles[idx - 1].isOwner || !canActorManageRole(roles[idx - 1].position)}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveRole(idx, 'up');
                            }}
                            className="p-0.5 hover:bg-zinc-700 rounded text-slate-400 hover:text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            title="Move Up"
                          >
                            <HiOutlineChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            disabled={idx === roles.length - 1 || isPending || !roles[idx + 1] || roles[idx + 1].name === '@everyone' || !canActorManageRole(roles[idx + 1].position)}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveRole(idx, 'down');
                            }}
                            className="p-0.5 hover:bg-zinc-700 rounded text-slate-400 hover:text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            title="Move Down"
                          >
                            <HiOutlineChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-zinc-650 italic shrink-0 select-none">Locked</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-800/60 text-[10px] text-slate-500 leading-relaxed font-medium">
              Roles are listed in rank hierarchy order. Higher roles override and manage roles beneath them.
            </div>
          </div>

          {/* Right Pane: Configuration Workspace */}
          <div className="col-span-3 p-6 bg-zinc-900/5 min-h-[500px] flex flex-col">
            {!activeRoleId && !isCreatingRole ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-zinc-800/80 rounded-xl my-auto bg-zinc-950/10">
                <HiOutlineShieldCheck className="w-12 h-12 text-slate-600 mb-4 opacity-50" />
                <h3 className="text-sm font-black text-slate-350 uppercase tracking-widest mb-1.5">No Role Selected</h3>
                <p className="text-zinc-500 text-xs max-w-sm leading-relaxed">
                  Select a role from the list on the left to customize its name, hex badge color, hierarchy position, and granular staff permissions.
                </p>
              </div>
            ) : (
              <form
                key={activeRoleId ?? 'new-role'}
                action={isCreatingRole ? handleCreateRoleSubmit : handleEditRoleSubmit}
                className="flex-1 flex flex-col justify-between"
              >
                <div className="space-y-6">
                  {/* Title and Action Header */}
                  <div className="border-b border-zinc-800 pb-4">
                    <div className="flex justify-between items-start gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base font-black text-white uppercase tracking-wider">
                            {isCreatingRole ? 'Create New Role' : 'Configure Role'}
                          </h3>
                          {!isCreatingRole && activeRole && (
                            <span
                              className="px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider"
                              style={{
                                backgroundColor: `${parseHexColor(activeRole.color)}12`,
                                color: parseHexColor(activeRole.color),
                                border: `1px solid ${parseHexColor(activeRole.color)}25`,
                              }}
                            >
                              {activeRole.name}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">
                          {isCreatingRole
                            ? 'Configure role styling and assign initial staff permissions.'
                            : `Update styling and permission policies for this role.`}
                        </p>
                      </div>
                      {!isCreatingRole && activeRole && !activeRole.isSystem && (
                        <button
                          type="button"
                          onClick={() => handleDeleteRole(activeRole.id)}
                          className="px-3 py-1.5 border border-red-900/30 hover:border-red-900/60 bg-red-950/10 hover:bg-red-950/30 text-red-400 font-bold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer whitespace-nowrap"
                        >
                          Delete Role
                        </button>
                      )}
                    </div>

                    {/* Tabs Bar */}
                    {(!activeRole || !activeRole.isOwner) && (
                      <div className="flex gap-4 mt-4">
                        <button
                          type="button"
                          onClick={() => setRoleTab('display')}
                          className={`text-xs font-bold uppercase tracking-wider pb-1.5 border-b-2 transition-all cursor-pointer ${
                            roleTab === 'display'
                              ? 'border-ez-pink text-white font-extrabold'
                              : 'border-transparent text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Display
                        </button>
                        <button
                          type="button"
                          onClick={() => setRoleTab('permissions')}
                          className={`text-xs font-bold uppercase tracking-wider pb-1.5 border-b-2 transition-all cursor-pointer ${
                            roleTab === 'permissions'
                              ? 'border-ez-pink text-white font-extrabold'
                              : 'border-transparent text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Permissions
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Tab Content: Display Settings */}
                  {(isCreatingRole || roleTab === 'display' || activeRole?.isOwner) && (
                    <div className="space-y-6 animate-in fade-in duration-200">
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
                            disabled={!isCreatingRole && activeRole?.isSystem}
                            defaultValue={isCreatingRole ? '' : activeRole?.name}
                            placeholder="e.g. Moderator"
                            className="w-full px-4 py-2.5 bg-background border border-zinc-800 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ez-pink focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed font-sans text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Badge Color
                          </label>
                          <div className="flex gap-2">
                            <div className="flex items-center gap-1.5 shrink-0 bg-background border border-zinc-850 rounded-lg px-2 py-1">
                              <input
                                type="color"
                                name="color"
                                value={selectedColor}
                                onChange={(e) => setSelectedColor(e.target.value)}
                                className="w-8 h-8 bg-transparent cursor-pointer border-0 p-0"
                              />
                              <input
                                type="text"
                                value={selectedColor}
                                onChange={(e) => setSelectedColor(e.target.value)}
                                placeholder="#94a3b8"
                                className="w-20 px-1 py-1 text-[11px] font-mono bg-zinc-950/40 border border-zinc-800 rounded text-foreground focus:outline-none focus:ring-1 focus:ring-ez-pink transition-all uppercase text-center"
                              />
                            </div>
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

                      {activeRole?.isOwner && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-xs px-4 py-3 rounded-lg font-sans">
                          This is the system Owner role. It automatically grants all permissions and bypasses all constraints. Its permissions cannot be modified.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab Content: Permissions Checkboxes */}
                  {!activeRole?.isOwner && (isCreatingRole || roleTab === 'permissions') && (
                    <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1 animate-in fade-in duration-200">
                      <div className="space-y-6">
                        {PERMISSION_GROUPS.map((group) => (
                          <div key={group.title} className="space-y-3 p-4 bg-zinc-950/20 border border-zinc-900 rounded-xl">
                            <h4 className="text-xs font-black text-white uppercase tracking-wider border-b border-zinc-800 pb-1.5 flex items-center gap-2 select-none">
                              <span className="w-1 h-3.5 bg-ez-pink rounded" />
                              <span>{group.title}</span>
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {group.permissions.map((label) => {
                                const hasPerm = activeRole ? (BigInt(activeRole.permissions) & label.bit) !== BigInt(0) : false;
                                const isActorMissing = !currentIsOwner && (currentPermissions & label.bit) === BigInt(0);

                                return (
                                  <label
                                    key={label.bit.toString()}
                                    className={`flex items-start gap-3 p-3 bg-zinc-950/30 border rounded-lg transition-all select-none ${
                                      isActorMissing
                                        ? 'opacity-45 border-zinc-850 cursor-not-allowed'
                                        : 'border-zinc-800 hover:border-zinc-700/60 cursor-pointer hover:bg-zinc-900/10'
                                    }`}
                                  >
                                    <input
                                      name={`perm_${label.bit.toString()}`}
                                      type="checkbox"
                                      value="true"
                                      defaultChecked={hasPerm}
                                      disabled={isActorMissing}
                                      className="rounded text-ez-pink focus:ring-ez-pink focus:ring-offset-0 bg-zinc-950 border-zinc-800 cursor-pointer disabled:cursor-not-allowed w-4 h-4 mt-0.5 shrink-0"
                                    />
                                    <div className="flex flex-col">
                                      <span
                                        className={`text-xs font-extrabold uppercase tracking-wide ${
                                          isActorMissing ? 'text-slate-500' : 'text-slate-200'
                                        }`}
                                      >
                                        {label.name}
                                      </span>
                                      <span className="text-[10px] text-slate-500 font-medium leading-relaxed mt-0.5">{label.desc}</span>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Save & Cancel Buttons */}
                <div className="mt-6 border-t border-zinc-800 pt-4 flex justify-end gap-3 bg-zinc-950/5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRoleId(null);
                      setIsCreatingRole(false);
                    }}
                    className="px-4 py-2 border border-zinc-850 hover:border-zinc-750 text-slate-400 hover:text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-5 py-2 bg-ez-pink hover:bg-ez-pink/80 text-ez-black font-extrabold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    {isPending ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

