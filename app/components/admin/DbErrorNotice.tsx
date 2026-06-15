import { HiExclamationTriangle } from 'react-icons/hi2';

interface DbErrorNoticeProps {
  /** Variant: 'not-configured' shows setup instructions, 'error' shows a generic DB error */
  variant?: 'not-configured' | 'error';
  /** Additional message to display below the default */
  message?: string;
}

/**
 * Consistent database error / not-configured notice for admin pages.
 * Replaces the ad-hoc ⚠️ emoji boxes and pink error boxes scattered across admin.
 */
export default function DbErrorNotice({ variant = 'not-configured', message }: DbErrorNoticeProps) {
  return (
    <div className="bg-amber-500/5 border border-amber-500/25 rounded-2xl p-6">
      <div className="flex items-start gap-4">
        <HiExclamationTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
        <div>
          {variant === 'not-configured' ? (
            <>
              <h3 className="text-base font-bold text-amber-400 tracking-tight">Database Not Configured</h3>
              <p className="text-slate-300 text-sm leading-relaxed mt-0.5">
                Set <code className="text-amber-300">DATABASE_URL</code> in your{' '}
                <code className="text-amber-300">.env</code> file and run{' '}
                <code className="text-amber-300">npm run db:push</code> to enable this section.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-base font-bold text-amber-400 tracking-tight">Database Error</h3>
              <p className="text-slate-300 text-sm leading-relaxed mt-0.5">
                Failed to load data. Please check your database connection and ensure migrations have run.
              </p>
            </>
          )}
          {message && (
            <p className="text-slate-400 text-xs mt-2 font-mono">{message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
