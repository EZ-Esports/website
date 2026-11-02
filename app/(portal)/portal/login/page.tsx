import type { Metadata } from 'next';
import Link from 'next/link';
import Card from '@/app/components/ui/Card';
import PortalLoginForm from './PortalLoginForm';

export const metadata: Metadata = {
  title: 'School Manager Login | EZ Esports',
  description: 'Sign in to access your high school esports team portal and roster management.',
};

interface PortalLoginPageProps {
  searchParams: Promise<{ message?: string; email?: string }>;
}

export default async function PortalLoginPage({ searchParams }: PortalLoginPageProps) {
  const { message, email } = await searchParams;

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      {/* Top Navigation Bar (logged out: no school selector, user badge or sign-out) */}
      <header className="sticky top-0 z-40 bg-[var(--surface-raised)]/90 backdrop-blur-md border-b border-[var(--line)] px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-lg font-black tracking-tight text-white hover:opacity-90 transition-opacity"
            >
              <span className="text-[#f4cccc] font-extrabold">EZ</span>
              <span>ESPORTS</span>
            </Link>
            <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-[#f4cccc]/15 text-[#f4cccc] border border-[#f4cccc]/30">
              Manager Portal
            </span>
          </div>
          <nav aria-label="Portal login" className="flex items-center gap-4 text-sm font-medium">
            <Link href="/login" className="text-[var(--foreground-secondary)] hover:text-white transition-colors min-h-[44px] inline-flex items-center">
              Staff Portal
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <Card padding="lg" className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-accent/15 text-accent mb-1">
            School Manager Portal
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            Sign In
          </h1>
          <p className="text-sm text-foreground-secondary">
            Manage your school rosters, verify student submissions, and generate player invite links.
          </p>
        </div>

        {message && (
          <div
            className="bg-success/10 border border-success/30 text-success text-sm px-4 py-3 rounded-lg"
            role="status"
          >
            {message}
          </div>
        )}

        {/* Login Form */}
        <PortalLoginForm defaultEmail={email} />

        {/* Footer Links */}
        <div className="pt-2 text-center border-t border-border/60">
          <p className="text-xs text-foreground-muted">
            Are you a league administrator?{' '}
            <Link href="/login" className="text-accent hover:underline font-medium">
              Staff Portal Login &rarr;
            </Link>
          </p>
        </div>
        </Card>
      </main>
    </div>
  );
}
