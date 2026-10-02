import type { Metadata } from 'next';
import Link from 'next/link';
import Card from '@/app/components/ui/Card';
import PortalLoginForm from './PortalLoginForm';

export const metadata: Metadata = {
  title: 'School Manager Login | EZ Esports',
  description: 'Sign in to access your high school esports team portal and roster management.',
};

interface PortalLoginPageProps {
  searchParams: Promise<{ message?: string }>;
}

export default async function PortalLoginPage({ searchParams }: PortalLoginPageProps) {
  const { message } = await searchParams;

  return (
    <main className="min-h-screen bg-surface flex flex-col justify-center items-center px-4 py-12">
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
        <PortalLoginForm />

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
  );
}
