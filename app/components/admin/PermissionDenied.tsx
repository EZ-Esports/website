import Link from 'next/link';
import { HiOutlineLockClosed } from 'react-icons/hi2';
import { AdminEmptyState } from '@/app/components/admin/AdminUI';
import { secondaryBtn } from '@/app/components/admin/styles';

/** Shown in place of a section the viewer's roles do not cover. Same anatomy as an empty state. */
export default function PermissionDenied() {
  return (
    <section className="admin-page-enter flex min-h-[55vh] items-center justify-center">
      <div className="w-full max-w-md rounded-2xl bg-admin-panel">
        <AdminEmptyState
          icon={<HiOutlineLockClosed />}
          titleAs="h1"
          alert
          title="Permission required"
          description="You are signed in, but your current roles do not grant access to this section. Ask a staff member with role-management permission if you need access."
          action={
            <Link href="/admin" className={secondaryBtn}>
              Return to overview
            </Link>
          }
        />
      </div>
    </section>
  );
}
