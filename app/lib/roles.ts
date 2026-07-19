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
  MANAGE_APPLICATIONS: BigInt(1) << BigInt(9), // View and accept school league applications
  MANAGE_SCHOOLS: BigInt(1) << BigInt(10),     // Manage registered schools
  MANAGE_CONTENT: BigInt(1) << BigInt(11),     // Edit public page CMS text blocks
} as const;

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
 * Discord-style hierarchy check for managing roles:
 * - Owners can manage any role.
 * - Non-owners can only manage roles with a position strictly lower than their highest role.
 */
export function canManageRole(
  actorHighestPosition: number,
  actorIsOwner: boolean,
  targetRolePosition: number
): boolean {
  if (actorIsOwner) return true;
  return actorHighestPosition > targetRolePosition;
}

/**
 * Prevents privilege escalation:
 * - Owners can grant any permissions.
 * - Non-owners can only grant permissions they currently possess (targetPermissions must be a subset of actorPermissions).
 */
export function canGrantPermissions(
  actorPermissions: bigint,
  actorIsOwner: boolean,
  targetPermissions: bigint
): boolean {
  if (actorIsOwner) return true;
  // targetPermissions & ~actorPermissions evaluates to all bits set in target but not in actor
  return (targetPermissions & ~actorPermissions) === BigInt(0);
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
