import Link from 'next/link';
import Card from '@/app/components/ui/Card';
import LoginForm from './LoginForm';
import { MESSAGE_MAP } from './messages';

interface LoginPageProps {
  searchParams: Promise<{ message?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { message } = await searchParams;
  const displayMessage = message ? (MESSAGE_MAP[message] ?? null) : null;

  return (
    // The marketing layout already offsets content by the fixed header (88px), so fill only the rest of the viewport.
    <main className="min-h-[calc(100vh-88px)] bg-surface flex flex-col justify-center items-center px-4 py-12">
      <Card padding="lg" className="w-full max-w-md space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
            Staff Portal
          </h1>
          <p className="text-sm text-foreground-secondary">
            Sign in to manage league configurations, news, and matches.
          </p>
        </div>

        {/* Success Alert (e.g. after accepting an invite) */}
        {displayMessage && (
          <div className="bg-success/10 border border-success/30 text-success text-sm px-4 py-3 rounded-lg" role="status">
            {displayMessage}
          </div>
        )}

        {/* Login Form (renders action errors via useActionState) */}
        <LoginForm />

        {/* Footer Links */}
        <div className="pt-2 text-center border-t border-border/60">
          <p className="text-xs text-foreground-muted">
            Are you a school manager?{' '}
            <Link href="/portal/login" className="text-accent hover:underline font-medium">
              Manager Portal Login &rarr;
            </Link>
          </p>
        </div>

      </Card>
    </main>
  );
}
