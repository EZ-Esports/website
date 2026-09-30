import Card from '@/app/components/ui/Card';
import LoginForm from './LoginForm';

interface LoginPageProps {
  searchParams: Promise<{ message?: string; error?: string }>;
}

// Allowlist of known message keys to fixed display strings — prevents arbitrary
// text from ?message= being reflected into the page (open redirect / XSS vector).
export const MESSAGE_MAP: Record<string, string> = {
  'account-created': 'Account created. Please sign in.',
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { message } = await searchParams;
  const displayMessage = message ? (MESSAGE_MAP[message] ?? null) : null;

  return (
    <main className="min-h-screen bg-surface flex flex-col justify-center items-center px-4 py-12">
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

      </Card>
    </main>
  );
}
