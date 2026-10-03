import { AdminSkeleton, AdminSkeletonRows } from '@/app/components/admin/AdminUI';

/**
 * Route-level skeleton in the shape every admin page shares (spec-013): page
 * header, then a panel of rows. It fades in after a short delay so quick
 * navigations never flash it.
 */
export default function AdminLoading() {
  return (
    <div className="admin-skeleton-enter space-y-6" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>

      {/* Page header */}
      <div className="space-y-3 pb-2">
        <AdminSkeleton className="h-7 w-64" />
        <AdminSkeleton className="h-4 w-96 max-w-full" />
      </div>

      {/* Section panel */}
      <div className="rounded-2xl bg-admin-panel pb-2">
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <AdminSkeleton className="h-5 w-40" />
          <AdminSkeleton className="h-8 w-56 rounded-lg" />
        </div>
        <AdminSkeletonRows rows={6} />
      </div>
    </div>
  );
}
