import Card from '@/app/components/ui/Card';
import { Field, Input } from '@/app/components/ui/form';
import { login } from './actions';
import SubmitButton from './SubmitButton';

interface LoginPageProps {
  searchParams: Promise<{ error?: string; message?: string }>;
}

// Allowlist of known message keys to fixed display strings — prevents arbitrary
// text from ?message= being reflected into the page (open redirect / XSS vector).
export const MESSAGE_MAP: Record<string, string> = {
  'account-created': 'Account created. Please sign in.',
};

// Allowlist of known error keys from login actions to fixed display strings — prevents arbitrary
// attacker-controlled query parameters (?error=...) from being reflected into the page.
export const DEFAULT_ERROR_MESSAGE = 'Sign in failed. Please try again.';

export const ERROR_MAP: Record<string, string> = {
  'Email and password are required.': 'Email and password are required.',
  'Too many login attempts. Please try again in 15 minutes.':
    'Too many login attempts. Please try again in 15 minutes.',
  'Invalid login credentials': 'Invalid login credentials.',
  'Invalid login credentials.': 'Invalid login credentials.',
  'Email not confirmed': 'Email not confirmed. Please check your inbox.',
  'Sign-in failed. Please try again.': 'Sign in failed. Please try again.',
  'Sign in failed. Please try again.': 'Sign in failed. Please try again.',
  'credentials-required': 'Email and password are required.',
  'invalid-credentials': 'Invalid login credentials.',
  'rate-limited': 'Too many login attempts. Please try again in 15 minutes.',
  'email-not-confirmed': 'Email not confirmed. Please check your inbox.',
  'auth-failed': 'Sign in failed. Please try again.',
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, message } = await searchParams;
  const displayMessage = message ? (MESSAGE_MAP[message] ?? null) : null;
  const displayError = error ? (ERROR_MAP[error] ?? DEFAULT_ERROR_MESSAGE) : null;

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
        {displayMessage && !displayError && (
          <div className="bg-success/10 border border-success/30 text-success text-sm px-4 py-3 rounded-lg" role="status">
            {displayMessage}
          </div>
        )}

        {/* Error Alert */}
        {displayError && (
          <div className="bg-danger/10 border border-danger/30 text-danger text-sm px-4 py-3 rounded-lg flex items-start gap-2" role="alert">
            <svg
              className="w-5 h-5 text-danger shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>{displayError}</span>
          </div>
        )}

        {/* Login Form */}
        <form action={login} className="space-y-4">
          <Field label="Email Address" htmlFor="email">
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="staff@ezesports.org"
            />
          </Field>

          <Field label="Password" htmlFor="password">
            <Input
              id="password"
              name="password"
              type="password"
              required
              placeholder="••••••••"
            />
          </Field>

          <SubmitButton />
        </form>

      </Card>
    </main>
  );
}
