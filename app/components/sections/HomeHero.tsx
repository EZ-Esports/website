import Image from 'next/image';
import Link from 'next/link';

interface CTA {
  label: string;
  href: string;
}

interface HomeHeroProps {
  title: string;
  subtitle?: string;
  backgroundImage: string;
  primaryCTA?: CTA;
}

/**
 * Homepage-only "broadcast" hero: full-bleed, bottom-aligned content over a
 * background photo with a heavy bottom-to-top gradient. This is a dedicated
 * component (not a variant of the shared `Hero.tsx`) because `Hero.tsx` is
 * reused by about/news/[game]/privacy and must stay centered/glass-panel for
 * those pages.
 */
export default function HomeHero({ title, subtitle, backgroundImage, primaryCTA }: HomeHeroProps) {
  // Helper to dynamically color brand words "EZ" and "Esports" pink.
  // Ported verbatim from Hero.tsx so CMS-edited titles stay consistent with
  // the rest of the site.
  const renderTitle = (text: string) => {
    if (text.trim().toLowerCase() === 'new york city high school esports league') {
      return text;
    }
    const parts = text.split(/(Esports|EZ)/g);
    return parts.map((part, i) => {
      if (part === 'Esports' || part === 'EZ') {
        return (
          <span key={i} className="text-accent font-black drop-shadow-[0_2px_10px_color-mix(in_srgb,var(--color-accent)_45%,transparent)]">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <section className="relative w-full min-h-[max(100vh,640px)] flex items-end overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0 z-0 select-none pointer-events-none">
        <Image
          src={backgroundImage}
          alt=""
          fill
          priority
          unoptimized
          className="object-cover object-center"
        />
        {/* Bottom-heavy gradient (legibility for bottom-aligned text) + top-right accent glow */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(0deg, rgba(13,8,9,.97) 0%, rgba(13,8,9,.6) 42%, rgba(13,8,9,.28) 70%, rgba(13,8,9,.62) 100%), radial-gradient(ellipse at 75% 15%, color-mix(in srgb, var(--color-accent) 18%, transparent) 0%, transparent 55%)',
          }}
        />
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 relative z-10 pb-16">
        <h1
          className="font-black text-foreground tracking-[-0.02em] leading-[1.06] max-w-[19ch]"
          style={{ fontSize: 'clamp(30px, 4.6vw, 54px)' }}
        >
          {renderTitle(title)}
        </h1>

        {subtitle && (
          <p className="mt-4 text-base text-foreground-secondary max-w-[52ch] leading-[1.6]">
            {subtitle}
          </p>
        )}

        {primaryCTA && (
          <div className="flex flex-wrap gap-3 mt-[26px]">
            <Link
              href={primaryCTA.href}
              className="inline-flex items-center justify-center gap-2 [clip-path:polygon(14px_0,100%_0,100%_calc(100%-14px),calc(100%-14px)_100%,0_100%,0_14px)] bg-accent text-on-accent hover:bg-white px-6 py-[13px] text-sm font-extrabold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:ring-offset-2 focus:ring-offset-surface"
            >
              {primaryCTA.label.toLowerCase().includes('discord') && (
                <svg className="w-5 h-5 -ml-1" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.094 13.094 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z"/>
                </svg>
              )}
              {primaryCTA.label}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
