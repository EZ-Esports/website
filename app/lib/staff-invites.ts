export function buildStaffInviteRoleRows(inviteId: string, roleIds: string[]) {
  return roleIds.map((roleId) => ({ inviteId, roleId }));
}
