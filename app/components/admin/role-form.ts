import { parseHexColor } from '@/app/lib/roles';

/** The slice of a role the editor needs. `permissions` is a string-serialized BigInt. */
interface RoleLike {
  name: string;
  color: string;
  permissions: string;
  isOwner: boolean;
  isSystem: boolean;
}

/** Everything the role editor's two panels edit, held in state so a hidden panel never loses its fields. */
export interface RoleDraft {
  name: string;
  color: string;
  permissions: bigint;
}

export const NEW_ROLE_COLOR = '#94a3b8';

/** Initial draft: the role's current values, or blank defaults for a new role. */
export function seedRoleDraft(role: RoleLike | null): RoleDraft {
  if (!role) return { name: '', color: NEW_ROLE_COLOR, permissions: 0n };
  return { name: role.name, color: parseHexColor(role.color), permissions: BigInt(role.permissions) };
}

/**
 * The request fields to submit. `editableBits` are the permission bits the actor
 * may change; the rest are dropped (the server rejects bits the actor lacks).
 * The Owner role's permissions are immutable, so they are sent as stored, and a
 * locked system role keeps its name.
 */
export function buildRoleRequest(
  draft: RoleDraft,
  role: RoleLike | null,
  editableBits: bigint,
): { name: string; color: string; permissions: string } {
  const permissions = role?.isOwner ? BigInt(role.permissions) : draft.permissions & editableBits;
  const name = role?.isSystem ? role.name : draft.name;
  return { name, color: draft.color, permissions: permissions.toString() };
}
