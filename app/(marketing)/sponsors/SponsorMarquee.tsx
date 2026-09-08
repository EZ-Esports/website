'use client';

import Image from 'next/image';
import { useAnimationFrame } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Button, ToggleButton } from 'react-aria-components';
import { usePrefersReducedMotion } from '@/app/lib/hooks/usePrefersReducedMotion';

interface MarqueeSponsor {
  id: string;
  name: string;
  logoUrl: string | null;
}

const SPEED_PX_PER_SEC = 40;
const NUDGE_PX = 260;
const MIN_REPEATS = 3;
// Extra copies of the sponsor list kept beyond what's needed to fill the
// viewport once, so there's always room to scroll (either direction, by
// hand or by autoplay) before we need to silently rewrap.
const BUFFER_REPEATS = 4;

const controlButtonClass =
  'flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-foreground-secondary transition-all duration-300 hover:border-accent/60 hover:bg-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised';

export default function SponsorMarquee({ sponsors }: { sponsors: MarqueeSponsor[] }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [playing, setPlaying] = useState(!prefersReducedMotion);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const unitWidthRef = useRef(0);
  const remainder = useRef(0);

  // How many copies of `sponsors` to render. A fixed "triple it" only works
  // if that's already wider than the viewport — with just a few sponsors
  // (a small student-run league might only have 2-3), even 3 copies can be
  // narrower than the screen, leaving nothing for native scroll to scroll.
  // So this is measured and grown until it comfortably overflows.
  const [repeats, setRepeats] = useState(MIN_REPEATS);
  const repeated = Array.from({ length: repeats }, () => sponsors).flat();

  useEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track || sponsors.length === 0) return;

    const measure = () => {
      const first = track.children[0] as HTMLElement | undefined;
      const nextCopyFirst = track.children[sponsors.length] as HTMLElement | undefined;
      if (!first || !nextCopyFirst) return;
      const unitWidth = nextCopyFirst.offsetLeft - first.offsetLeft;
      if (unitWidth <= 0) return;
      unitWidthRef.current = unitWidth;

      const needed = Math.max(MIN_REPEATS, Math.ceil(container.clientWidth / unitWidth) + BUFFER_REPEATS);
      setRepeats((prev) => (prev === needed ? prev : needed));

      if (container.scrollLeft === 0) {
        container.scrollLeft = unitWidth;
      } else {
        const max = container.scrollWidth - container.clientWidth;
        if (max > 3 * unitWidth && (container.scrollLeft < unitWidth || container.scrollLeft > max - unitWidth)) {
          container.scrollLeft = unitWidth + (container.scrollLeft % unitWidth);
        }
      }
    };
    measure();
    // Keeps the loop's wrap point in sync with resize, zoom, orientation
    // change, and webfont swaps — all of which can change the track's
    // rendered width after mount.
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(track);
    return () => observer.disconnect();
  }, [sponsors]);

  // Native scroll handles momentum swiping and wheel gestures naturally.
  // We silently re-wrap scrollLeft when it approaches buffer boundaries to create an infinite loop.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const unit = unitWidthRef.current;
      if (!unit) return;
      const max = container.scrollWidth - container.clientWidth;
      if (max <= 3 * unit) return;

      while (container.scrollLeft > max - unit) {
        const prev = container.scrollLeft;
        container.scrollLeft -= unit;
        if (container.scrollLeft >= prev) break;
      }
      while (container.scrollLeft < unit) {
        const prev = container.scrollLeft;
        container.scrollLeft += unit;
        if (container.scrollLeft <= prev) break;
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useAnimationFrame((_, delta) => {
    const container = containerRef.current;
    if (!playing || prefersReducedMotion || !container || isHovered) return;
    const clampedDelta = Math.min(delta, 64);
    remainder.current += (clampedDelta / 1000) * SPEED_PX_PER_SEC;
    const whole = Math.trunc(remainder.current);
    if (!whole) return;
    remainder.current -= whole;
    container.scrollLeft += whole;
  });

  const nudge = (direction: -1 | 1) => {
    setPlaying(false);
    containerRef.current?.scrollBy({ left: direction * NUDGE_PX, behavior: 'smooth' });
  };

  return (
    <div className="border-y border-line bg-surface-raised py-6">
      <div
        ref={containerRef}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') setIsHovered(true);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') setIsHovered(false);
        }}
        onFocusCapture={() => setIsHovered(true)}
        onBlurCapture={() => setIsHovered(false)}
        className="overflow-x-auto no-scrollbar [mask-image:linear-gradient(to_right,transparent,black_3%,black_97%,transparent)]"
      >
        <div ref={trackRef} className="flex w-max items-center gap-10 px-6">
          {repeated.map((item, i) => (
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

      {!prefersReducedMotion && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button onPress={() => nudge(-1)} aria-label="Move sponsor logos left" className={controlButtonClass}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M15 5l-7 7 7 7V5z" />
            </svg>
          </Button>
          <ToggleButton
            isSelected={playing}
            onChange={setPlaying}
            aria-label="Auto-scroll sponsor logos"
            className={controlButtonClass}
          >
            {playing ? (
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
          <Button onPress={() => nudge(1)} aria-label="Move sponsor logos right" className={controlButtonClass}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M9 5l7 7-7 7V5z" />
            </svg>
          </Button>
        </div>
      )}
    </div>
  );
}
