import { AdminNotice } from '@/app/components/admin/AdminUI';

interface DbErrorNoticeProps {
  /** Variant: 'not-configured' shows setup instructions, 'error' shows a generic DB error */
  variant?: 'not-configured' | 'error';
  /** Additional message to display below the default */
  message?: string;
}

const code = 'rounded bg-surface-sunken px-1 py-0.5 font-mono text-[0.8125rem] text-foreground';

/**
 * Consistent database error / not-configured notice for admin pages: the
 * shared warning notice, so it reads like every other page-level message.
 */
export default function DbErrorNotice({ variant = 'not-configured', message }: DbErrorNoticeProps) {
  return (
    <AdminNotice
      tone="warning"
      live="none"
      title={variant === 'not-configured' ? 'Database not configured' : 'Database error'}
    >
      {variant === 'not-configured' ? (
        <p>
          Set <code className={code}>DATABASE_URL</code> in your <code className={code}>.env</code> file and run{' '}
          <code className={code}>npm run db:push</code> to enable this section.
        </p>
      ) : (
        <p>Failed to load data. Please check your database connection and ensure migrations have run.</p>
      )}
      {message && <p className="mt-2 font-mono text-xs">{message}</p>}
    </AdminNotice>
  );
}
