import { HiOutlineExclamationTriangle } from 'react-icons/hi2';
import { logout } from '@/app/(admin)/admin/actions';
import { AdminEmptyState } from '@/app/components/admin/AdminUI';
import { secondaryBtn } from '@/app/components/admin/styles';

/** Full-screen state when the signed-in account has no usable staff record (rendered without the shell). */
export default function StaffSetupProblem({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-surface flex items-center justify-center px-4 py-12">
      <div className="admin-page-enter w-full max-w-md rounded-2xl bg-admin-panel">
        <AdminEmptyState
          icon={<HiOutlineExclamationTriangle />}
          tone="warning"
          titleAs="h1"
          title="Account setup needs attention"
          description={
            <>
              {message}
              <span className="mt-2 block text-xs">
                Your session is still valid. Signing out is optional and will not repair the staff record.
              </span>
            </>
          }
          action={
            <form action={logout}>
              <button type="submit" className={secondaryBtn}>
                Sign out
              </button>
            </form>
          }
        />
      </div>
    </main>
  );
}
