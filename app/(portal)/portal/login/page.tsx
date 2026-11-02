import type { Metadata } from 'next';
import Link from 'next/link';
import Card from '@/app/components/ui/Card';
import Header from '@/app/components/layout/Header';
import Footer from '@/app/components/layout/Footer';
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
    <div className="bg-surface text-foreground">
      <Header />
      {/* Fills the viewport below the fixed header so the card is centered in what is visible. The footer sits below the fold and shows on scroll. */}
      <main className="min-h-screen flex items-center justify-center px-4 pt-[88px]">
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

        </Card>
      </main>
      <Footer />
    </div>
  );
}
