import Link from 'next/link';
import Button from '@/app/components/ui/Button';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-8 px-4 text-center">
      {/* Brand accent */}
      <div className="select-none" aria-hidden="true">
        <span className="text-8xl font-black text-accent/20 tracking-tighter">404</span>
      </div>

      <div className="space-y-3 -mt-4">
        <h1 className="text-3xl font-black text-foreground tracking-tight">Page Not Found</h1>
        <p className="text-foreground-secondary text-base max-w-md">
          We couldn&apos;t find what you were looking for. The page may have moved or no longer exists.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 justify-center">
        <Button href="/" variant="primary">
          Back to Home
        </Button>
        <Button href="/news" variant="secondary">
          Latest News
        </Button>
      </div>

      <nav aria-label="Helpful links" className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm text-foreground-secondary">
        <Link href="/valorant" className="hover:text-accent transition-colors">Valorant</Link>
        <Link href="/league-of-legends" className="hover:text-accent transition-colors">League of Legends</Link>
        <Link href="/team-fight-tactics" className="hover:text-accent transition-colors">Teamfight Tactics</Link>
        <Link href="/apply" className="hover:text-accent transition-colors">Apply</Link>
        <Link href="/about" className="hover:text-accent transition-colors">About</Link>
      </nav>
    </div>
  );
}
