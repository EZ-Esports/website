import { hasPermission, Permissions } from '@/app/lib/roles';

export const ADMIN_SECTION_PERMISSIONS = {
  '/admin/league': Permissions.MANAGE_LEAGUE,
  '/admin/matches': Permissions.MANAGE_MATCHES,
  '/admin/standings': Permissions.MANAGE_MATCHES,
  '/admin/news': Permissions.MANAGE_NEWS,
  '/admin/leadership': Permissions.MANAGE_LEADERSHIP,
  '/admin/gallery': Permissions.MANAGE_GALLERY,
  '/admin/sponsors': Permissions.MANAGE_SPONSORS,
  '/admin/schools': Permissions.MANAGE_SCHOOLS,
  '/admin/careers': Permissions.MANAGE_APPLICATIONS,
  '/admin/applications': Permissions.MANAGE_APPLICATIONS,
  '/admin/content': Permissions.MANAGE_CONTENT,
  '/admin/team': Permissions.MANAGE_ROLES,
  '/admin/onboarding-form': Permissions.MANAGE_LEAGUE,
} as const;

/**
 * Roster data is its own permission even though it is viewed inside Schools
 * (Schools -> View rosters). It is not a sidebar section, so it is not in
 * `ADMIN_SECTION_PERMISSIONS`; pages and `hasAnyManagementPermission` use this
 * directly so a roster-only role still counts as staff.
 */
export const ADMIN_ROSTER_VIEW_PERMISSION = Permissions.MANAGE_ROSTERS;

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
  return [...Object.values(ADMIN_SECTION_PERMISSIONS), ADMIN_ROSTER_VIEW_PERMISSION].some((required) =>
    hasPermission(permissions, isOwner, required),
  );
}
