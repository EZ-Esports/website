export type AdminRole = 'admin' | 'super_admin';

/** True when `role` is the highest tier. */
export function isSuperAdmin(role: AdminRole): boolean {
  return role === 'super_admin';
}

/**
 * True when an actor of `actorRole` may grant/act on a target of `targetRole`.
 * Acting on a super_admin requires super_admin; anything else is allowed.
 */
export function canActOnRole(actorRole: AdminRole, targetRole: AdminRole): boolean {
  if (targetRole === 'super_admin') return isSuperAdmin(actorRole);
  return true;
}
