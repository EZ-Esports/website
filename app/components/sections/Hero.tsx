import Image from 'next/image';
import Button from '@/app/components/ui/Button';

interface CTA {
  label: string;
  href: string;
}

interface HeroProps {
  title: string;
  subtitle?: string;
  backgroundImage: string;
  size?: 'large' | 'medium';
  primaryCTA?: CTA;
  /** Disables the scroll-linked background parallax and its overscan buffer, rendering the image at its natural cover-fit resolution. Defaults to true. */
  parallax?: boolean;
}

export default function Hero({
  title,
  subtitle,
  backgroundImage,
  size = 'medium',
  primaryCTA,
}: HeroProps) {
  const isLarge = size === 'large';

  // Helper to dynamically color brand words "EZ", "Esports", and "New York City" pink
  const renderTitle = (text: string) => {
    const parts = text.split(/(New York City|Esports|EZ)/gi);
    return parts.map((part, i) => {
      const lower = part.toLowerCase();
      if (lower === 'new york city' || lower === 'esports' || lower === 'ez') {
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
    <section className={`relative overflow-hidden w-full ${isLarge ? 'h-screen' : 'h-[35vh]'} flex items-center`}>
      {/* Background Image */}
      <div className="absolute inset-0 select-none pointer-events-none z-0">
        <Image
          src={backgroundImage}
          alt=""
          fill
          priority
          unoptimized
          className="object-cover object-center"
        />
        {/* Darkens the top of the image so the transparent header's white nav text
            stays readable against the (sometimes pale) background photo. */}
        <div
          className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0.15)_20%,transparent_100%)]"
        />
      </div>

      {/* Hero Content Container */}
      <div className="relative z-10 w-full flex items-center justify-center px-4">
        {isLarge ? (
          <div className="max-w-3xl mx-auto rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden text-center w-full bg-white/5 backdrop-blur-md border border-white/15">
            {/* Soft internal card glow */}
            <div className="absolute -top-24 -left-24 w-60 h-60 bg-accent/12 rounded-full blur-[80px] pointer-events-none z-0" />
            <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-accent-secondary/12 rounded-full blur-[80px] pointer-events-none z-0" />

            <div className="relative z-10 flex flex-col items-center">
              {/* Heading */}
              <h1 className="font-black tracking-tight text-foreground text-3xl sm:text-4xl md:text-[46px] leading-[1.1] drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]">
                {renderTitle(title)}
              </h1>

              {/* Subtitle */}
              {subtitle && (
                <p className="text-foreground-secondary font-medium max-w-3xl mx-auto leading-relaxed mt-6 text-sm sm:text-base md:text-lg drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.4)]">
                  {subtitle}
                </p>
              )}

              {/* CTAs */}
              {primaryCTA && (
                <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
                  <Button
                    href={primaryCTA.href}
                    variant="primary"
                    className="min-w-[180px] shadow-lg shadow-accent/10 hover:shadow-accent/25 hover:scale-[1.03] transition-all duration-300"
                  >
                    {primaryCTA.label.toLowerCase().includes('discord') && (
                      <svg className="w-5 h-5 mr-2 -ml-1 text-on-accent" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.094 13.094 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z" />
                      </svg>
                    )}
                    {primaryCTA.label}
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
            {/* Heading */}
            <h1 className="font-black tracking-tight text-foreground text-2xl sm:text-3xl md:text-4xl">
              {renderTitle(title)}
            </h1>

            {/* Subtitle */}
            {subtitle && (
              <p className="text-foreground/90 font-medium max-w-3xl mx-auto leading-relaxed mt-4 text-xs sm:text-sm">
                {subtitle}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
