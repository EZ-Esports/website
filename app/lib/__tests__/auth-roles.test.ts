import { describe, it, expect } from 'vitest';
import { Permissions, hasPermission, canActOnMember, canManageRole, nextRolePosition, filterAssignableRoles, canGrantPermissions, calculateEffectiveStaffAccess, RETIRED_PERMISSION_BITS, withoutRetiredPermissionBits } from '../roles';
import { getAllowedAdminHrefs, hasAnyManagementPermission } from '../staff-access';
import { buildStaffInviteRoleRows } from '../staff-invites';

describe('hasPermission', () => {
  it('identifies if a user has specific permission', () => {
    const userPerms = Permissions.MANAGE_NEWS | Permissions.MANAGE_MATCHES;
    expect(hasPermission(userPerms, false, Permissions.MANAGE_NEWS)).toBe(true);
    expect(hasPermission(userPerms, false, Permissions.MANAGE_LEAGUE)).toBe(false);
  });

  it('allows owner to bypass permission checks', () => {
    expect(hasPermission(BigInt(0), true, Permissions.MANAGE_ROLES)).toBe(true);
  });

  it('allows administrator to bypass permission checks', () => {
    expect(hasPermission(Permissions.ADMINISTRATOR, false, Permissions.MANAGE_ROLES)).toBe(true);
  });
});

describe('effective staff access', () => {
  it('includes @everyone for a zero-role member', () => {
    const access = calculateEffectiveStaffAccess([], {
      permissions: Permissions.MANAGE_NEWS,
      position: 0,
      isOwner: false,
    });
    expect(access).toEqual({
      permissions: Permissions.MANAGE_NEWS,
      isOwner: false,
      highestRolePosition: 0,
    });
  });

  it('allows a valid member to have zero effective permissions', () => {
    expect(calculateEffectiveStaffAccess([], null)).toEqual({
      permissions: BigInt(0),
      isOwner: false,
      highestRolePosition: 0,
    });
  });

  it('combines assigned role permissions and preserves Owner override state', () => {
    const access = calculateEffectiveStaffAccess([
      { permissions: Permissions.MANAGE_MATCHES, position: 4, isOwner: false },
      { permissions: BigInt(0), position: 99, isOwner: true },
    ], { permissions: Permissions.MANAGE_NEWS, position: 0, isOwner: false });
    expect(access.permissions).toBe(Permissions.MANAGE_MATCHES | Permissions.MANAGE_NEWS);
    expect(access.isOwner).toBe(true);
    expect(access.highestRolePosition).toBe(99);
  });
});

describe('staff route decisions', () => {
  it('keeps zero-permission staff on overview only', () => {
    expect(getAllowedAdminHrefs(BigInt(0), false)).toEqual(['/admin']);
    expect(hasAnyManagementPermission(BigInt(0), false)).toBe(false);
  });

  it('maps one permission to the matching navigation and direct routes', () => {
    expect(getAllowedAdminHrefs(Permissions.MANAGE_MATCHES, false)).toEqual([
      '/admin',
      '/admin/matches',
      '/admin/standings',
    ]);
  });

  it('grants all routes to Administrator and Owner', () => {
    expect(getAllowedAdminHrefs(Permissions.ADMINISTRATOR, false).length).toBeGreaterThan(10);
    expect(getAllowedAdminHrefs(BigInt(0), true)).toEqual(
      getAllowedAdminHrefs(Permissions.ADMINISTRATOR, false),
    );
  });
});

describe('optional invite roles', () => {
  it('creates a valid empty assignment set', () => {
    expect(buildStaffInviteRoleRows('invite-id', [])).toEqual([]);
  });
});

describe('canActOnMember', () => {
  it('allows owners to act on anyone', () => {
    expect(canActOnMember(0, true, 100, false)).toBe(true);
    expect(canActOnMember(0, true, 0, true)).toBe(true);
  });

  it('denies non-owners from acting on owners', () => {
    expect(canActOnMember(999, false, 0, true)).toBe(false);
  });

  it('allows non-owners to act on lower roles', () => {
    expect(canActOnMember(50, false, 40, false)).toBe(true);
  });

  it('denies non-owners from acting on equal or higher roles', () => {
    expect(canActOnMember(50, false, 50, false)).toBe(false);
    expect(canActOnMember(50, false, 60, false)).toBe(false);
  });
});

describe('canManageRole', () => {
  it('allows owners to manage any position, including owner roles', () => {
    expect(canManageRole(0, true, 9999, false)).toBe(true);
    expect(canManageRole(0, true, 9999, true)).toBe(true);
  });

  it('allows non-owners to manage strictly lower position non-owner roles', () => {
    expect(canManageRole(50, false, 49, false)).toBe(true);
  });

  it('denies non-owners from managing equal or higher position roles', () => {
    expect(canManageRole(50, false, 50, false)).toBe(false);
    expect(canManageRole(50, false, 51, false)).toBe(false);
  });

  it('denies a non-owner an owner role even when their rank is higher than the owner role', () => {
    // Inverted hierarchy (Dev=10000 above Owner=9999) must not let Dev reach the Owner role.
    expect(canManageRole(10000, false, 9999, true)).toBe(false);
    expect(canManageRole(10001, false, 0, true)).toBe(false);
  });
});

describe('nextRolePosition', () => {
  const owner = { position: 9999, isOwner: true };
  const everyone = { position: 0, isOwner: false };

  it('places a role created by an owner actor directly above the highest non-owner role and below the Owner role', () => {
    const result = nextRolePosition({
      roles: [everyone, { position: 1, isOwner: false }, { position: 2, isOwner: false }, owner],
      actorIsOwner: true,
      actorHighestPosition: 9999,
    });
    expect(result).toEqual({ position: 3, shiftNonOwnerRoles: false });
  });

  it('is not fooled by the Owner role being the max position (the old max+1 bug)', () => {
    const result = nextRolePosition({ roles: [everyone, owner], actorIsOwner: true, actorHighestPosition: 9999 });
    expect(result?.position).toBe(1);
    expect(result!.position).toBeLessThan(9999);
  });

  it('refuses when a non-owner role already sits at or above the Owner role', () => {
    const inverted = [everyone, { position: 10000, isOwner: false }, owner];
    expect(nextRolePosition({ roles: inverted, actorIsOwner: true, actorHighestPosition: 9999 })).toBeNull();
    const atOwner = [everyone, { position: 9999, isOwner: false }, owner];
    expect(nextRolePosition({ roles: atOwner, actorIsOwner: true, actorHighestPosition: 9999 })).toBeNull();
  });

  it('refuses when the owner-actor slot would equal the Owner position', () => {
    const roles = [everyone, { position: 9998, isOwner: false }, owner];
    expect(nextRolePosition({ roles, actorIsOwner: true, actorHighestPosition: 9999 })).toBeNull();
  });

  it('starts at 1 on an empty table or with only @everyone', () => {
    expect(nextRolePosition({ roles: [], actorIsOwner: true, actorHighestPosition: 0 })).toEqual({ position: 1, shiftNonOwnerRoles: false });
    expect(nextRolePosition({ roles: [everyone], actorIsOwner: false, actorHighestPosition: 5 })).toEqual({ position: 1, shiftNonOwnerRoles: false });
  });

  it('keeps non-owner behavior: slots just above the highest role below the actor and shifts roles at/above it', () => {
    const roles = [everyone, { position: 10, isOwner: false }, { position: 50, isOwner: false }, { position: 80, isOwner: false }, owner];
    expect(nextRolePosition({ roles, actorIsOwner: false, actorHighestPosition: 50 })).toEqual({ position: 11, shiftNonOwnerRoles: true });
  });

  it('refuses a non-owner insert whose shift would push a role into the Owner position', () => {
    const roles = [everyone, { position: 5, isOwner: false }, { position: 9998, isOwner: false }, owner];
    expect(nextRolePosition({ roles, actorIsOwner: false, actorHighestPosition: 9998 })).toBeNull();
  });
});

describe('filterAssignableRoles', () => {
  const roles = [
    { name: '@everyone', position: 0, isOwner: false, permissions: '0' },
    { name: 'Viewer', position: 1, isOwner: false, permissions: '0' },
    { name: 'Owner', position: 9999, isOwner: true, permissions: '1' },
  ];

  it('never offers an owner role to a non-owner, even one ranked above it', () => {
    const dev = { permissions: BigInt(4095), isOwner: false, highestRolePosition: 10000 };
    expect(filterAssignableRoles(roles, dev).map((r) => r.name)).toEqual(['Viewer']);
  });

  it('offers everything except @everyone to an owner', () => {
    const owner = { permissions: BigInt(1), isOwner: true, highestRolePosition: 9999 };
    expect(filterAssignableRoles(roles, owner).map((r) => r.name)).toEqual(['Viewer', 'Owner']);
  });
});

describe('canGrantPermissions', () => {
  it('allows owners to grant anything', () => {
    expect(canGrantPermissions(BigInt(0), true, Permissions.ADMINISTRATOR)).toBe(true);
  });

  it('allows non-owners to grant subset of their permissions', () => {
    const actorPerms = Permissions.MANAGE_NEWS | Permissions.MANAGE_MATCHES;
    expect(canGrantPermissions(actorPerms, false, Permissions.MANAGE_NEWS)).toBe(true);
    expect(canGrantPermissions(actorPerms, false, actorPerms)).toBe(true);
  });

  it('denies non-owners from granting permissions they do not possess', () => {
    const actorPerms = Permissions.MANAGE_NEWS | Permissions.MANAGE_MATCHES;
    expect(canGrantPermissions(actorPerms, false, Permissions.MANAGE_LEAGUE)).toBe(false);
    expect(canGrantPermissions(actorPerms, false, actorPerms | Permissions.MANAGE_LEAGUE)).toBe(false);
  });

  describe('retired permission bits', () => {
    it('reserves bit 12 and strips it from a mask', () => {
      expect(RETIRED_PERMISSION_BITS).toBe(BigInt(1) << BigInt(12));
      expect(withoutRetiredPermissionBits(RETIRED_PERMISSION_BITS | Permissions.MANAGE_NEWS)).toBe(Permissions.MANAGE_NEWS);
    });

    it('lets a non-owner grant a stored role that still carries the retired bit, since the bit grants nothing', () => {
      const actorPerms = Permissions.MANAGE_NEWS;
      const stored = Permissions.MANAGE_NEWS | RETIRED_PERMISSION_BITS;
      expect(canGrantPermissions(actorPerms, false, stored)).toBe(true);
      expect(canGrantPermissions(actorPerms, false, RETIRED_PERMISSION_BITS)).toBe(true);
    });

    it('still refuses real permissions the actor lacks, retired bit or not', () => {
      const stored = Permissions.MANAGE_LEAGUE | RETIRED_PERMISSION_BITS;
      expect(canGrantPermissions(Permissions.MANAGE_NEWS, false, stored)).toBe(false);
    });

    it('keeps such a role in the assignable list for a non-owner who holds its real permissions', () => {
      const roles = [
        { name: 'Legacy', position: 1, isOwner: false, permissions: (Permissions.MANAGE_NEWS | RETIRED_PERMISSION_BITS).toString() },
      ];
      const actor = { permissions: Permissions.MANAGE_NEWS, isOwner: false, highestRolePosition: 5 };
      expect(filterAssignableRoles(roles, actor)).toHaveLength(1);
    });
  });
});
