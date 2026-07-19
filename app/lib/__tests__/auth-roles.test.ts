import { describe, it, expect } from 'vitest';
import { Permissions, hasPermission, canActOnMember, canManageRole, canGrantPermissions, calculateEffectiveStaffAccess } from '../roles';
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
  it('allows owners to manage any position', () => {
    expect(canManageRole(0, true, 9999)).toBe(true);
  });

  it('allows non-owners to manage strictly lower position roles', () => {
    expect(canManageRole(50, false, 49)).toBe(true);
  });

  it('denies non-owners from managing equal or higher position roles', () => {
    expect(canManageRole(50, false, 50)).toBe(false);
    expect(canManageRole(50, false, 51)).toBe(false);
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
});
