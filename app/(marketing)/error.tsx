'use client';

import { useEffect } from 'react';
import Button from '@/app/components/ui/Button';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function MarketingError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('Page error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-4 text-center bg-surface">
      <div className="w-16 h-16 rounded-full bg-accent/10 border border-accent/25 flex items-center justify-center">
        <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <div>
        <h1 className="text-2xl font-black text-foreground mb-2">Something went wrong</h1>
        <p className="text-foreground-secondary text-sm max-w-md">
          We ran into an unexpected issue. You can try reloading the page or head back to the home page.
        </p>
      </div>
      <div className="flex flex-wrap gap-3 justify-center">
        <Button onClick={reset} variant="primary">
          Try again
        </Button>
        <Button href="/" variant="secondary">
          Back to home
        </Button>
      </div>
    </div>
  );
}
