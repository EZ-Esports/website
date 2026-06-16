import { login } from './actions';
import SubmitButton from './SubmitButton';

interface LoginPageProps {
  searchParams: Promise<{ error?: string; message?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, message } = await searchParams;

  return (
    <main className="min-h-screen bg-background flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md bg-background-secondary border border-custom-border/80 rounded-2xl p-8 shadow-2xl space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
            Admin Portal
          </h1>
          <p className="text-sm text-foreground-secondary">
            Sign in to manage league configurations, news, and matches.
          </p>
        </div>

        {/* Success Alert (e.g. after accepting an invite) */}
        {message && !error && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-300 text-sm px-4 py-3 rounded-lg" role="status">
            {message}
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-4 py-3 rounded-lg flex items-start gap-2" role="alert">
            <svg
              className="w-5 h-5 text-red-400 shrink-0 mt-0.5"
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
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form action={login} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground-secondary mb-1">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="admin@ezesports.org"
              className="w-full px-4 py-3 bg-background border border-custom-border/80 rounded-lg text-foreground placeholder-foreground-secondary/40 focus:outline-none focus:ring-2 focus:ring-ez-pink focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground-secondary mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-background border border-custom-border/80 rounded-lg text-foreground placeholder-foreground-secondary/40 focus:outline-none focus:ring-2 focus:ring-ez-pink focus:border-transparent transition-all"
            />
          </div>

          <SubmitButton />
        </form>

      </div>
    </main>
  );
}
