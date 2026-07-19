import { hasPermission, Permissions } from '@/app/lib/roles';

export const ADMIN_SECTION_PERMISSIONS = {
  '/admin/league': Permissions.MANAGE_LEAGUE,
  '/admin/matches': Permissions.MANAGE_MATCHES,
  '/admin/standings': Permissions.MANAGE_MATCHES,
  '/admin/roster': Permissions.MANAGE_ROSTERS,
  '/admin/news': Permissions.MANAGE_NEWS,
  '/admin/leadership': Permissions.MANAGE_LEADERSHIP,
  '/admin/gallery': Permissions.MANAGE_GALLERY,
  '/admin/sponsors': Permissions.MANAGE_SPONSORS,
  '/admin/schools': Permissions.MANAGE_SCHOOLS,
  '/admin/applications': Permissions.MANAGE_APPLICATIONS,
  '/admin/content': Permissions.MANAGE_CONTENT,
  '/admin/team': Permissions.MANAGE_ROLES,
} as const;

export type AdminSectionHref = keyof typeof ADMIN_SECTION_PERMISSIONS;

export function getAllowedAdminHrefs(permissions: bigint, isOwner: boolean): string[] {
  return [
    '/admin',
    ...Object.entries(ADMIN_SECTION_PERMISSIONS)
      .filter(([, required]) => hasPermission(permissions, isOwner, required))
      .map(([href]) => href),
  ];
}

export function hasAnyManagementPermission(permissions: bigint, isOwner: boolean): boolean {
  return Object.values(ADMIN_SECTION_PERMISSIONS).some((required) =>
    hasPermission(permissions, isOwner, required),
  );
}
