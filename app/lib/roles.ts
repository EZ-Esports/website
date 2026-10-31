export const Permissions = {
  ADMINISTRATOR: BigInt(1) << BigInt(0),       // Bypasses all permission checks (grants everything)
  MANAGE_ROLES: BigInt(1) << BigInt(1),        // Create, edit, delete, reorder roles; assign roles to users
  MANAGE_LEAGUE: BigInt(1) << BigInt(2),       // Create/edit/delete games, seasons, teams
  MANAGE_ROSTERS: BigInt(1) << BigInt(3),      // Manage rosters and player assignments
  MANAGE_MATCHES: BigInt(1) << BigInt(4),      // Schedule matches, report scores, change status
  MANAGE_NEWS: BigInt(1) << BigInt(5),         // Manage news articles/announcements
  MANAGE_LEADERSHIP: BigInt(1) << BigInt(6),   // Manage leadership team listings
  MANAGE_GALLERY: BigInt(1) << BigInt(7),      // Upload, arrange, and delete gallery images
  MANAGE_SPONSORS: BigInt(1) << BigInt(8),     // Manage sponsors and tiers
  MANAGE_APPLICATIONS: BigInt(1) << BigInt(9), // View and accept school and staff applications
  MANAGE_SCHOOLS: BigInt(1) << BigInt(10),     // Manage registered schools
  MANAGE_CONTENT: BigInt(1) << BigInt(11),     // Edit public page CMS text blocks
} as const;

/**
 * Permission bits that no longer mean anything. Bit 12 was VIEW_STUDENT_DEMOGRAPHICS, retired when
 * the demographics survey was removed (spec-051). It must never be reused or renumbered because
 * stored role bitmasks may still carry it, so it is reserved here instead of being deleted.
 */
export const RETIRED_PERMISSION_BITS = BigInt(1) << BigInt(12);

/** A permission mask without the retired bits; the only form that may be compared, granted or shown. */
export function withoutRetiredPermissionBits(permissions: bigint): bigint {
  return permissions & ~RETIRED_PERMISSION_BITS;
}

/**
 * Checks whether user permissions satisfy a required permission.
 * Owner and anyone with ADMINISTRATOR automatically pass all checks.
 */
export function hasPermission(
  userPermissions: bigint,
  isOwner: boolean,
  requiredPermission: bigint
): boolean {
  if (isOwner) return true;
  if ((userPermissions & Permissions.ADMINISTRATOR) !== BigInt(0)) return true;
  return (userPermissions & requiredPermission) !== BigInt(0);
}

export interface StaffRoleGrant {
  permissions: bigint;
  position: number;
  isOwner: boolean;
}

/** Combine explicit roles with the implicit @everyone role. */
export function calculateEffectiveStaffAccess(
  assignedRoles: StaffRoleGrant[],
  everyoneRole: StaffRoleGrant | null,
) {
  const effectiveRoles = everyoneRole ? [...assignedRoles, everyoneRole] : assignedRoles;
  return {
    permissions: effectiveRoles.reduce((mask, role) => mask | BigInt(role.permissions), BigInt(0)),
    isOwner: effectiveRoles.some((role) => role.isOwner),
    highestRolePosition: effectiveRoles.reduce(
      (highest, role) => Math.max(highest, role.position),
      0,
    ),
  };
}

/**
 * Discord-style hierarchy check for actions on other members:
 * - Owners can act on anyone.
 * - Non-owners cannot act on owners.
 * - Non-owners can only act on users whose highest role position is strictly lower than theirs.
 */
export function canActOnMember(
  actorHighestPosition: number,
  actorIsOwner: boolean,
  targetHighestPosition: number,
  targetIsOwner: boolean
): boolean {
  if (actorIsOwner) return true;
  if (targetIsOwner) return false;
  return actorHighestPosition > targetHighestPosition;
}

/**
 * Discord-style hierarchy check for managing (or granting) a role:
 * - Owners can manage any role.
 * - An owner role (`targetRoleIsOwner`) can be managed ONLY by an owner, whatever the
 *   positions say. Rank is a convenience for ordering; it must never be the only thing
 *   standing between a non-owner and the Owner role, because stored positions can drift.
 * - Non-owners can only manage roles with a position strictly lower than their highest role.
 *
 * `targetRoleIsOwner` is deliberately required so no call site can forget it.
 */
export function canManageRole(
  actorHighestPosition: number,
  actorIsOwner: boolean,
  targetRolePosition: number,
  targetRoleIsOwner: boolean
): boolean {
  if (actorIsOwner) return true;
  if (targetRoleIsOwner) return false;
  return actorHighestPosition > targetRolePosition;
}

export interface RolePositionInput {
  position: number;
  isOwner: boolean;
}

export interface RolePlacement {
  /** Position the new role is inserted at. */
  position: number;
  /** True when existing non-owner roles at/above `position` must be shifted up by one first. */
  shiftNonOwnerRoles: boolean;
}

/**
 * Chooses where a newly created role goes. Owner roles are always the top of the
 * hierarchy, so a new role must land strictly below the lowest owner role, and the
 * shift that makes room must never push a non-owner role to or past an owner role.
 *
 * - Owner actor: directly above the highest non-owner role (no shift needed).
 * - Non-owner actor: directly above the highest role below the actor's own rank; roles
 *   at or above that slot (including the actor's) shift up by one.
 *
 * Returns `null` when there is no room below the owner roles, which also happens if stored
 * positions are already inverted (a non-owner role at/above an owner role). Failing loudly
 * is intentional: silently placing a role there is how the hierarchy got inverted.
 */
export function nextRolePosition(args: {
  roles: RolePositionInput[];
  actorIsOwner: boolean;
  actorHighestPosition: number;
}): RolePlacement | null {
  const { roles, actorIsOwner, actorHighestPosition } = args;
  const nonOwnerPositions = roles.filter((r) => !r.isOwner).map((r) => r.position);
  const ownerPositions = roles.filter((r) => r.isOwner).map((r) => r.position);
  const lowestOwner = ownerPositions.length > 0 ? Math.min(...ownerPositions) : Infinity;
  const highestNonOwner = nonOwnerPositions.length > 0 ? Math.max(...nonOwnerPositions) : null;

  let position: number;
  if (actorIsOwner) {
    position = highestNonOwner === null ? 1 : highestNonOwner + 1;
  } else {
    const below = nonOwnerPositions.filter((p) => p < actorHighestPosition);
    position = below.length > 0 ? Math.max(...below) + 1 : 1;
  }

  const shiftNonOwnerRoles = highestNonOwner !== null && highestNonOwner >= position;
  const topAfterInsert = shiftNonOwnerRoles ? highestNonOwner + 1 : position;
  if (position >= lowestOwner || topAfterInsert >= lowestOwner) return null;

  return { position, shiftNonOwnerRoles };
}

/**
 * Prevents privilege escalation:
 * - Owners can grant any permissions.
 * - Retired bits (see RETIRED_PERMISSION_BITS) are ignored on the target: a role that still carries
 *   one from before it was retired must stay assignable, because the bit grants nothing and the
 *   actor can never possess it to satisfy the subset rule below.
 * - Non-owners can only grant permissions they currently possess (targetPermissions must be a subset of actorPermissions).
 */
export function canGrantPermissions(
  actorPermissions: bigint,
  actorIsOwner: boolean,
  targetPermissions: bigint
): boolean {
  if (actorIsOwner) return true;
  // targetPermissions & ~actorPermissions evaluates to all bits set in target but not in actor
  return (withoutRetiredPermissionBits(targetPermissions) & ~actorPermissions) === BigInt(0);
}

/**
 * Roles an actor may hand out (invite pickers, member role editors). Built from the same
 * predicates the server actions enforce so the UI cannot offer a role the server refuses —
 * in particular an owner role is never offered to a non-owner.
 */
export function filterAssignableRoles<
  R extends { name: string; position: number; isOwner: boolean; permissions: string | bigint },
>(
  roles: R[],
  actor: { permissions: bigint; isOwner: boolean; highestRolePosition: number },
): R[] {
  return roles.filter(
    (role) =>
      role.name !== '@everyone' &&
      canManageRole(actor.highestRolePosition, actor.isOwner, role.position, role.isOwner) &&
      canGrantPermissions(actor.permissions, actor.isOwner, BigInt(role.permissions)),
  );
}

/**
 * Safely normalizes any color input (expanding 3-char hexes to 6-char,
 * handling missing `#` tags) to guarantee background opacity (`hex + "12"`)
 * and border opacity (`hex + "25"`) inline styles render cleanly.
 */
export function parseHexColor(color: string): string {
  let clean = (color || '').trim().replace(/^#/, '');

  if (clean.length === 3) {
    clean = clean.split('').map((char) => char + char).join('');
  }

  if (clean.length === 8) {
    clean = clean.slice(0, 6);
  }

  const hexRegex = /^[0-9a-fA-F]{6}$/;
  if (!hexRegex.test(clean)) {
    clean = '94a3b8'; // fallback Slate 400
  }

  return `#${clean}`;
}
