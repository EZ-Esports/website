'use client';

import { useState, useTransition } from 'react';
import { FiTrash2 } from 'react-icons/fi';
import {
  chip,
  deleteIconBtn,
  focusRing,
  ghostBtnSm,
  ghostBtn,
  input,
  label as labelClass,
  listStack,
  primaryBtn,
  segmentedGroup,
  segmentedItem,
} from '@/app/components/admin/styles';
import { AdminCount, AdminEmptyState, AdminNotice, AdminSearchField, AdminSection, PendingLabel } from '@/app/components/admin/AdminUI';
import { AdminTab, AdminTabList, AdminTabPanel, AdminTabs } from '@/app/components/admin/AdminTabs';
import { cx } from '@/app/lib/cx';
import { buildRoleRequest, seedRoleDraft, type RoleDraft } from '@/app/components/admin/role-form';
import InviteStaffForm from '@/app/components/admin/InviteStaffForm';
import { canActOnMember, Permissions, parseHexColor, hasPermission } from '@/app/lib/roles';
import StaffRow from '@/app/components/admin/StaffRow';
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

interface StaffMember {
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
  staffMembers: StaffMember[];
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
  {
    title: 'Student Data & Privacy Vault',
    permissions: [
      {
        bit: Permissions.VIEW_STUDENT_DEMOGRAPHICS,
        name: 'View Student Demographics',
        desc: 'Access sensitive student demographic, Title I equity, and survey records. Restricted strictly to Superadmins.',
        superadminOnly: true,
      },
    ],
  },
];

const PERMISSION_LABELS = PERMISSION_GROUPS.flatMap((g) => g.permissions);

export default function TeamManagerClient({ current, staffMembers, invites, roles }: TeamManagerClientProps) {
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
  // The role editor's fields live in state, not in the DOM: its Display and Permissions
  // panels mount one at a time, so a submit must never depend on which one is showing.
  const [roleDraft, setRoleDraft] = useState<RoleDraft>(() => seedRoleDraft(null));
  const selectedColor = roleDraft.color;
  const setSelectedColor = (color: string) => setRoleDraft((d) => ({ ...d, color }));

  const activeRole = roles.find((r) => r.id === activeRoleId) || null;

  // Permissions helpers
  const currentPermissions = BigInt(current.permissions);
  const currentIsOwner = current.isOwner;

  // Filter assignable roles: strictly lower than actor's highest role, and actor must possess their permissions
  const assignableRoles = roles.filter((role) => {
    if (role.name === '@everyone') return false;
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



  // Permission bits the actor may change; disabled checkboxes (missing from the actor or superadmin-only) stay out.
  const editableBits = PERMISSION_LABELS.reduce((mask, label) => {
    const locked = (label as { superadminOnly?: boolean }).superadminOnly && !currentIsOwner;
    const missing = !currentIsOwner && (currentPermissions & label.bit) === BigInt(0);
    return locked || missing ? mask : mask | label.bit;
  }, 0n);

  function toRequestBody() {
    const { name, color, permissions } = buildRoleRequest(roleDraft, activeRole, editableBits);
    const bodyData = new FormData();
    bodyData.append('name', name);
    bodyData.append('color', color);
    bodyData.append('permissions', permissions);
    return bodyData;
  }

  // Handle Create Role
  function handleCreateRoleSubmit() {
    setError(null);
    const bodyData = toRequestBody();

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
  function handleEditRoleSubmit() {
    if (!activeRole) return;
    setError(null);
    const bodyData = toRequestBody();

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

  const filteredStaff = staffMembers.filter((member) => {
    const matchesSearch = member.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRoleId ? member.roles.some((r) => r.id === filterRoleId) : true;
    return matchesSearch && matchesRole;
  });

  const reorderBtn = cx(
    'inline-flex h-7 w-7 items-center justify-center rounded-md text-foreground-secondary hover:text-foreground hover:bg-line/70 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-colors',
    focusRing,
  );

  return (
    <AdminTabs
      selectedKey={activeTab}
      onSelectionChange={(key) => {
        setActiveTab(key as 'staff' | 'roles');
        setError(null);
      }}
    >
      <AdminTabList aria-label="Roles and staff sections">
        <AdminTab id="staff">
          <HiOutlineUsers aria-hidden className="w-4 h-4" />
          Staff members
        </AdminTab>
        <AdminTab id="roles">
          <HiOutlineShieldCheck aria-hidden className="w-4 h-4" />
          Roles manager
        </AdminTab>
      </AdminTabList>

      {error && (
        <AdminNotice tone="danger" onDismiss={() => setError(null)}>
          {error}
        </AdminNotice>
      )}

      <AdminTabPanel id="staff">
        <AdminTabs
          selectedKey={staffSubTab}
          onSelectionChange={(key) => {
            setStaffSubTab(key as 'members' | 'invites');
            setError(null);
          }}
        >
          <AdminTabList aria-label="Staff views" variant="pill">
            <AdminTab id="members" variant="pill">
              Active members <span className="tabular-nums text-foreground-secondary">{staffMembers.length}</span>
            </AdminTab>
            <AdminTab id="invites" variant="pill">
              Invites &amp; onboarding <span className="tabular-nums text-foreground-secondary">{invites.length}</span>
            </AdminTab>
          </AdminTabList>

          {/* Sub-tab 1: Members Directory */}
          <AdminTabPanel id="members">
            <AdminSection
              variant="flush"
              title={<>Members<AdminCount>{filteredStaff.length}</AdminCount></>}
              toolbar={
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  {/* Search input */}
                  <AdminSearchField
                    className="w-full sm:w-72"
                    aria-label="Search staff by email"
                    placeholder="Search by email…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onClear={() => setSearchQuery('')}
                  />

                  {/* Role filter dropdown */}
                  <select
                    aria-label="Filter by role"
                    value={filterRoleId}
                    onChange={(e) => setFilterRoleId(e.target.value)}
                    className={cx(input, 'sm:w-56 cursor-pointer')}
                  >
                    <option value="">All roles</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>
              }
            >
              {filteredStaff.length === 0 ? (
                <AdminEmptyState
                  compact
                  icon={<HiOutlineUsers />}
                  title="No staff members found"
                  description="Try clearing your filters or search terms."
                />
              ) : (
                <ul className={listStack}>
                  {filteredStaff.map((member) => {
                    const targetHighestPos = member.roles.reduce((max, r) => (r.position > max ? r.position : max), 0);
                    const targetIsOwner = member.roles.some((r) => r.isOwner);
                    const canManage = canActOnMember(current.highestRolePosition, currentIsOwner, targetHighestPos, targetIsOwner);

                    return (
                      <StaffRow
                        key={member.userId}
                        member={{ userId: member.userId, email: member.email, roles: member.roles, createdAt: member.createdAt }}
                        isSelf={member.userId === current.id}
                        canRevoke={canManage}
                        assignableRoles={assignableRoles}
                      />
                    );
                  })}
                </ul>
              )}
            </AdminSection>
          </AdminTabPanel>

          {/* Sub-tab 2: Invites & Onboarding */}
          <AdminTabPanel id="invites" className="space-y-6">
            <AdminSection
              title="Invite a staff member"
              description="Generates a single-use onboarding link. Roles are optional; every accepted invite receives implicit @everyone membership."
            >
              <InviteStaffForm assignableRoles={assignableRoles} />
            </AdminSection>

            <AdminSection variant="flush" title={<>Pending onboardings<AdminCount>{invites.length}</AdminCount></>}>
              {invites.length === 0 ? (
                <AdminEmptyState
                  compact
                  icon={<HiOutlineShieldCheck />}
                  title="No pending onboardings"
                  description="All sent invitations have been successfully claimed or expired."
                />
              ) : (
                <ul className={listStack}>
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
                </ul>
              )}
            </AdminSection>
          </AdminTabPanel>
        </AdminTabs>
      </AdminTabPanel>

      <AdminTabPanel id="roles">
        <div className="grid min-h-[600px] grid-cols-1 overflow-hidden rounded-2xl bg-admin-panel md:grid-cols-[17rem_1fr]">
          {/* Left Pane: Role Directory Sidebar */}
          <div className="flex flex-col justify-between gap-4 border-b border-line/60 p-3 md:border-b-0 md:border-r">
            <div>
              <div className="flex items-center justify-between px-2 pt-1 pb-3">
                <h2 className="text-sm font-semibold text-foreground">Roles</h2>
                {(currentIsOwner || hasPermission(currentPermissions, currentIsOwner, Permissions.MANAGE_ROLES)) && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingRole(true);
                      setActiveRoleId(null);
                      setRoleTab('display');
                      setRoleDraft(seedRoleDraft(null));
                    }}
                    className={ghostBtnSm}
                    title="Create Role"
                  >
                    <HiOutlinePlus aria-hidden className="w-4 h-4" />
                    New role
                  </button>
                )}
              </div>

              <ul className="admin-stagger max-h-[500px] space-y-0.5 overflow-y-auto">
                {roles.map((role, idx) => {
                  const isActive = activeRoleId === role.id && !isCreatingRole;
                  const parsedColor = parseHexColor(role.color);
                  const isReorderable = !role.isOwner && role.name !== '@everyone' && canActorManageRole(role.position);
                  const selectRole = () => {
                    setActiveRoleId(role.id);
                    setIsCreatingRole(false);
                    setRoleTab('display');
                    setRoleDraft(seedRoleDraft(role));
                  };

                  return (
                    <li
                      key={role.id}
                      className={cx(
                        'group flex items-center justify-between gap-1 rounded-lg pr-1 transition-colors duration-150',
                        isActive ? 'bg-surface-raised text-foreground' : 'text-foreground-secondary hover:bg-surface-raised/60 hover:text-foreground',
                      )}
                    >
                      {/* The row's main hit area is a real button, so roles are reachable by keyboard. */}
                      <button
                        type="button"
                        onClick={selectRole}
                        aria-pressed={isActive}
                        className={cx('flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 py-2.5 text-left cursor-pointer', focusRing)}
                      >
                        {/* Colored Circle representing role color, matching Discord */}
                        <span
                          aria-hidden
                          className="h-3 w-3 shrink-0 rounded-full ring-2 ring-black/30"
                          style={{ backgroundColor: parsedColor }}
                        />
                        <span className={cx('truncate text-sm', isActive && 'font-medium')}>{role.name}</span>
                      </button>

                      {/* Reordering controls: always visible (touch has no hover), quieter until the row is hovered or focused. */}
                      {isReorderable ? (
                        <div className="flex items-center opacity-60 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                          <button
                            type="button"
                            disabled={idx === 0 || isPending || !roles[idx - 1] || roles[idx - 1].isOwner || !canActorManageRole(roles[idx - 1].position)}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveRole(idx, 'up');
                            }}
                            className={reorderBtn}
                            title="Move Up"
                            aria-label={`Move ${role.name} up`}
                          >
                            <HiOutlineChevronUp aria-hidden className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === roles.length - 1 || isPending || !roles[idx + 1] || roles[idx + 1].name === '@everyone' || !canActorManageRole(roles[idx + 1].position)}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveRole(idx, 'down');
                            }}
                            className={reorderBtn}
                            title="Move Down"
                            aria-label={`Move ${role.name} down`}
                          >
                            <HiOutlineChevronDown aria-hidden className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="shrink-0 select-none px-2 text-xs text-foreground-secondary">Locked</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            <p className="border-t border-line/60 px-2 pt-3 text-xs leading-5 text-foreground-secondary">
              Roles are listed in rank hierarchy order. Higher roles override and manage roles beneath them.
            </p>
          </div>

          {/* Right Pane: Configuration Workspace */}
          <div className="flex min-h-[500px] flex-col p-6">
            {!activeRoleId && !isCreatingRole ? (
              <AdminEmptyState
                className="my-auto"
                icon={<HiOutlineShieldCheck />}
                title="No role selected"
                description="Select a role from the list on the left to customize its name, hex badge color, hierarchy position, and granular staff permissions."
              />
            ) : (
              <form
                key={activeRoleId ?? 'new-role'}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (isCreatingRole) handleCreateRoleSubmit();
                  else handleEditRoleSubmit();
                }}
                className="admin-fade-in flex flex-1 flex-col justify-between"
              >
                <div className="space-y-6">
                  {/* Title and Action Header */}
                  <div className="border-b border-line/60 pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold text-foreground">
                            {isCreatingRole ? 'Create new role' : 'Configure role'}
                          </h2>
                          {!isCreatingRole && activeRole && (
                            <span
                              className="inline-flex h-6 items-center rounded-md px-2 text-xs font-medium"
                              style={{
                                backgroundColor: `${parseHexColor(activeRole.color)}1f`,
                                color: parseHexColor(activeRole.color),
                              }}
                            >
                              {activeRole.name}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-foreground-secondary">
                          {isCreatingRole
                            ? 'Configure role styling and assign initial staff permissions.'
                            : `Update styling and permission policies for this role.`}
                        </p>
                      </div>
                      {!isCreatingRole && activeRole && !activeRole.isSystem && (
                        <button
                          type="button"
                          onClick={() => handleDeleteRole(activeRole.id)}
                          aria-label={`Delete role ${activeRole.name}`}
                          title={`Delete role ${activeRole.name}`}
                          className={deleteIconBtn}
                        >
                          <FiTrash2 aria-hidden="true" className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* Display / Permissions switch. Plain toggle buttons on purpose: each
                        panel's fields only mount while it is shown; the values live in roleDraft. */}
                    {(!activeRole || !activeRole.isOwner) && (
                      <div className={cx(segmentedGroup, 'mt-4')}>
                        <button
                          type="button"
                          aria-pressed={roleTab === 'display'}
                          onClick={() => setRoleTab('display')}
                          className={cx(segmentedItem(roleTab === 'display'), 'cursor-pointer')}
                        >
                          Display
                        </button>
                        <button
                          type="button"
                          aria-pressed={roleTab === 'permissions'}
                          onClick={() => setRoleTab('permissions')}
                          className={cx(segmentedItem(roleTab === 'permissions'), 'cursor-pointer')}
                        >
                          Permissions
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Tab Content: Display Settings */}
                  {(isCreatingRole || roleTab === 'display' || activeRole?.isOwner) && (
                    <div className="admin-fade-in space-y-6">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label htmlFor="role-name" className={labelClass}>
                            Role name
                          </label>
                          <input
                            id="role-name"
                            name="name"
                            type="text"
                            required
                            disabled={!isCreatingRole && activeRole?.isSystem}
                            value={roleDraft.name}
                            onChange={(e) => setRoleDraft((d) => ({ ...d, name: e.target.value }))}
                            placeholder="e.g. Moderator"
                            className={input}
                          />
                        </div>

                        <div>
                          <span className={labelClass}>Badge color</span>
                          <div className="flex gap-2">
                            <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line/70 bg-surface-sunken px-1.5 py-1">
                              <input
                                type="color"
                                name="color"
                                aria-label="Badge color picker"
                                value={selectedColor}
                                onChange={(e) => setSelectedColor(e.target.value)}
                                className="h-7 w-7 cursor-pointer border-0 bg-transparent p-0"
                              />
                              <input
                                type="text"
                                aria-label="Badge color hex value"
                                value={selectedColor}
                                onChange={(e) => setSelectedColor(e.target.value)}
                                placeholder="#94a3b8"
                                className="w-20 rounded-md bg-transparent px-1 py-1 text-center font-mono text-xs uppercase text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                              />
                            </div>
                            <div className="flex flex-1 flex-wrap items-center gap-1.5 rounded-lg bg-surface-sunken px-2.5 py-1.5">
                              {PRESET_COLORS.map((c) => {
                                const isActive = selectedColor.toLowerCase() === c.toLowerCase();
                                return (
                                  <button
                                    key={c}
                                    type="button"
                                    onClick={() => setSelectedColor(c)}
                                    aria-label={`Use color ${c}`}
                                    aria-pressed={isActive}
                                    className={cx(
                                      'h-4 w-4 cursor-pointer rounded-full outline-none transition-[scale,box-shadow] duration-150 hover:scale-125 motion-reduce:hover:scale-100 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-sunken',
                                      isActive ? 'scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-surface-sunken' : 'ring-1 ring-black/30',
                                    )}
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
                        <AdminNotice tone="danger" live="none">
                          This is the system Owner role. It automatically grants all permissions and bypasses all constraints. Its permissions cannot be modified.
                        </AdminNotice>
                      )}
                    </div>
                  )}

                  {/* Tab Content: Permissions Checkboxes */}
                  {!activeRole?.isOwner && (isCreatingRole || roleTab === 'permissions') && (
                    <div className="admin-fade-in max-h-[420px] space-y-6 overflow-y-auto pr-1">
                      {PERMISSION_GROUPS.map((group) => (
                        <fieldset key={group.title}>
                          <legend className="mb-2 text-sm font-semibold text-foreground">{group.title}</legend>
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            {group.permissions.map((label) => {
                              const hasPerm = (roleDraft.permissions & label.bit) !== BigInt(0);
                              const isSuperadminLocked = Boolean((label as any).superadminOnly && !currentIsOwner);
                              const isActorMissing = !currentIsOwner && (currentPermissions & label.bit) === BigInt(0);
                              const isDisabled = isActorMissing || isSuperadminLocked;

                              return (
                                <label
                                  key={label.bit.toString()}
                                  className={cx(
                                    'flex select-none items-start gap-3 rounded-lg bg-surface-sunken/60 p-3 transition-colors duration-150',
                                    isDisabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:bg-surface-raised',
                                  )}
                                >
                                  <input
                                    name={`perm_${label.bit.toString()}`}
                                    type="checkbox"
                                    checked={hasPerm}
                                    onChange={(e) =>
                                      setRoleDraft((d) => ({
                                        ...d,
                                        permissions: e.target.checked ? d.permissions | label.bit : d.permissions & ~label.bit,
                                      }))
                                    }
                                    disabled={isDisabled}
                                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-accent disabled:cursor-not-allowed"
                                  />
                                  <span className="flex flex-col">
                                    <span className="flex flex-wrap items-center gap-2">
                                      <span className={cx('text-sm font-medium', isDisabled ? 'text-foreground-secondary' : 'text-foreground')}>
                                        {label.name}
                                      </span>
                                      {(label as any).superadminOnly && <span className={chip('danger', 'sm')}>Superadmin only</span>}
                                    </span>
                                    <span className="mt-0.5 text-xs leading-5 text-foreground-secondary">{label.desc}</span>
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </fieldset>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Save & Cancel Buttons */}
                <div className="mt-6 flex justify-end gap-2 border-t border-line/60 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRoleId(null);
                      setIsCreatingRole(false);
                    }}
                    className={ghostBtn}
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={isPending} aria-busy={isPending} className={primaryBtn}>
                    <PendingLabel pending={isPending} label="Save changes" pendingLabel="Saving…" />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </AdminTabPanel>
    </AdminTabs>
  );
}
