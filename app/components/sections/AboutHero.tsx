import Image from 'next/image';
import CutCTA from '@/app/components/ui/CutCTA';

interface CTA {
  label: string;
  href: string;
  external?: boolean;
}

interface AboutHeroProps {
  title: string;
  subtitle?: string;
  backgroundImage: string;
  primaryCTA?: CTA;
  secondaryCTA?: CTA;
}

/**
 * About-only "broadcast" hero: full-bleed photo, uppercase display type. A
 * dedicated component (not a variant of the shared `Hero.tsx`, mirroring how
 * `HomeHero.tsx` forks for the homepage) because Hero.tsx stays
 * centered/glass-panel for news/[game]/privacy.
 */
export default function AboutHero({ title, subtitle, backgroundImage, primaryCTA, secondaryCTA }: AboutHeroProps) {
  // Helper to color the brand words "EZ" and "Esports" pink, ported from Hero.tsx/HomeHero.tsx.
  const renderTitle = (text: string) => {
    const parts = text.split(/(Esports|EZ)/gi);
    return parts.map((part, i) => {
      const lower = part.toLowerCase();
      if (lower === 'esports' || lower === 'ez') {
        return (
          <span key={i} className="text-accent drop-shadow-[0_2px_10px_color-mix(in_srgb,var(--color-accent)_45%,transparent)]">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <section className="relative w-full min-h-[min(92vh,860px)] overflow-hidden [clip-path:polygon(0_0,100%_0,100%_94%,0_100%)]">
      {/* Background image */}
      <div className="absolute inset-0 z-0 select-none pointer-events-none">
        <Image
          src={backgroundImage}
          alt=""
          fill
          priority
          unoptimized
          className="object-cover object-[center_30%]"
        />
        {/* Bottom-heavy gradient for legibility, plus a top scrim so the
            transparent header's nav text stays readable over the photo. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(10,10,10,.72) 0%, rgba(10,10,10,.22) 30%, rgba(10,10,10,.5) 72%, rgba(10,10,10,.95) 100%)',
          }}
        />
        {/* Faint scanline texture: a light broadcast-overlay cue, not a load-bearing effect. */}
        <div
          className="absolute inset-0 opacity-40 mix-blend-overlay"
          style={{
            backgroundImage:
              'repeating-linear-gradient(180deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 3px)',
          }}
          aria-hidden="true"
        />
      </div>

      {/* Content, bottom-anchored */}
      <div className="absolute inset-x-0 bottom-0 z-10 pb-14 sm:pb-16">
        <div className="container mx-auto px-6 sm:px-10 lg:px-16 xl:px-24">
          <h1
            className="font-black uppercase tracking-tight leading-[0.94] text-foreground max-w-[16ch] drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
            style={{ fontSize: 'clamp(38px, 8vw, 92px)' }}
          >
            {renderTitle(title)}
          </h1>

          {subtitle && (
            <p className="mt-5 max-w-[62ch] text-base sm:text-lg leading-relaxed text-foreground-secondary font-medium">
              {subtitle}
            </p>
          )}

          {(primaryCTA || secondaryCTA) && (
            <div className="flex flex-wrap gap-3 mt-8">
              {primaryCTA && (
                <CutCTA href={primaryCTA.href} variant="primary" external={primaryCTA.external}>
                  {primaryCTA.label}
                </CutCTA>
              )}
              {secondaryCTA && (
                <CutCTA href={secondaryCTA.href} variant="outline" external={secondaryCTA.external}>
                  {secondaryCTA.label}
                </CutCTA>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
