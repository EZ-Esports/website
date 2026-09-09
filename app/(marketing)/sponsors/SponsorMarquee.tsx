'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import AutoScroll from 'embla-carousel-auto-scroll';
import { Button, ToggleButton } from 'react-aria-components';
import { usePrefersReducedMotion } from '@/app/lib/hooks/usePrefersReducedMotion';

export interface MarqueeSponsor {
  id: string;
  name: string;
  logoUrl: string | null;
}

export function padSponsors(list?: MarqueeSponsor[] | null, minLength = 32): MarqueeSponsor[] {
  if (!list || list.length === 0) return [];
  const repetitions = Math.max(2, Math.ceil(minLength / list.length));
  return Array.from({ length: repetitions }, () => list).flat();
}

const controlButtonClass =
  'flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-foreground-secondary transition-all duration-300 hover:border-accent/60 hover:bg-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised cursor-pointer';

export default function SponsorMarquee({ sponsors }: { sponsors: MarqueeSponsor[] }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isPlaying, setIsPlaying] = useState(!prefersReducedMotion);

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: true,
      dragFree: true,
    },
    [
      AutoScroll({
        speed: 1,
        stopOnInteraction: false,
        stopOnMouseEnter: true,
        stopOnFocusIn: true,
        playOnInit: !prefersReducedMotion,
      }),
    ]
  );

  useEffect(() => {
    const autoScroll = emblaApi?.plugins()?.autoScroll;
    if (!autoScroll) return;

    setIsPlaying(autoScroll.isPlaying());

    const onPlay = () => setIsPlaying(true);
    const onStop = () => setIsPlaying(false);
    const onReInit = () => setIsPlaying(autoScroll.isPlaying());

    emblaApi.on('autoScroll:play', onPlay);
    emblaApi.on('autoScroll:stop', onStop);
    emblaApi.on('reInit', onReInit);

    return () => {
      emblaApi.off('autoScroll:play', onPlay);
      emblaApi.off('autoScroll:stop', onStop);
      emblaApi.off('reInit', onReInit);
    };
  }, [emblaApi]);

  useEffect(() => {
    const autoScroll = emblaApi?.plugins()?.autoScroll;
    if (!autoScroll) return;
    if (prefersReducedMotion) {
      autoScroll.stop();
    }
  }, [emblaApi, prefersReducedMotion]);

  const toggleAutoScroll = useCallback(() => {
    const autoScroll = emblaApi?.plugins()?.autoScroll;
    if (!autoScroll) return;

    if (autoScroll.isPlaying()) {
      autoScroll.stop();
    } else {
      autoScroll.play();
    }
  }, [emblaApi]);

  const scrollPrev = useCallback(() => {
    if (!emblaApi) return;
    const autoScroll = emblaApi.plugins()?.autoScroll;
    if (autoScroll) autoScroll.reset();
    emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (!emblaApi) return;
    const autoScroll = emblaApi.plugins()?.autoScroll;
    if (autoScroll) autoScroll.reset();
    emblaApi.scrollNext();
  }, [emblaApi]);

  const items = padSponsors(sponsors);

  if (!sponsors || sponsors.length === 0) return null;

  return (
    <div className="border-y border-line bg-surface-raised py-6">
      <div
        ref={emblaRef}
        className="overflow-hidden select-none touch-pan-y [mask-image:linear-gradient(to_right,transparent,black_3%,black_97%,transparent)]"
      >
        <div className="flex items-center gap-10">
          {items.map((item, i) => (
            <div key={`${item.id}-${i}`} className="flex shrink-0 items-center justify-center">
              {item.logoUrl ? (
                <Image
                  src={item.logoUrl}
                  alt={`${item.name} logo`}
                  width={130}
                  height={40}
                  className="h-8 w-auto object-contain opacity-90"
                />
              ) : (
                <span className="whitespace-nowrap text-base font-black uppercase tracking-wide text-foreground-muted">
                  {item.name}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <Button onPress={scrollPrev} aria-label="Previous sponsors" className={controlButtonClass}>
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M15 5l-7 7 7 7V5z" />
          </svg>
        </Button>
        <ToggleButton
          isSelected={isPlaying}
          onChange={toggleAutoScroll}
          aria-label="Auto-scroll sponsor logos"
          className={controlButtonClass}
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M7 5l12 7-12 7V5z" />
            </svg>
          )}
        </ToggleButton>
        <Button onPress={scrollNext} aria-label="Next sponsors" className={controlButtonClass}>
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M9 5l7 7-7 7V5z" />
          </svg>
        </Button>
      </div>
    </div>
  );
}
