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
const BUFFER_REPEATS = 3;

const controlButtonClass =
  'flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-foreground-secondary transition-all duration-300 hover:border-accent/60 hover:bg-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised';

export default function SponsorMarquee({ sponsors }: { sponsors: MarqueeSponsor[] }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [playing, setPlaying] = useState(!prefersReducedMotion);
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const unitWidthRef = useRef(0);
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
      const items = Array.from(track.children).slice(0, sponsors.length) as HTMLElement[];
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const unitWidth = last.offsetLeft + last.offsetWidth - first.offsetLeft;
      if (unitWidth <= 0) return;
      unitWidthRef.current = unitWidth;

      const needed = Math.max(MIN_REPEATS, Math.ceil(container.clientWidth / unitWidth) + BUFFER_REPEATS);
      setRepeats((prev) => (prev === needed ? prev : needed));
      // Re-center within the run, preserving relative scroll position.
      container.scrollLeft = unitWidth + (container.scrollLeft % unitWidth);
    };
    measure();
    // Keeps the loop's wrap point in sync with resize, zoom, orientation
    // change, and webfont swaps — all of which can change the track's
    // rendered width after mount.
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [sponsors]);

  // Native scroll does almost all of the work here: a trackpad's horizontal
  // swipe (deltaX) already scrolls this row with zero JS, and nudge/autoplay
  // just move scrollLeft directly. The one thing native scroll *can't* do is
  // a plain mouse's vertical wheel — that only ever reports deltaY, and
  // since the page itself also scrolls vertically, the browser's default
  // target for that axis is the page, not this row, even while hovering it.
  // So we redirect deltaY into scrollLeft ourselves, but only take over when
  // deltaX isn't already carrying the gesture.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      setPlaying(false);
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    };
    const handleScroll = () => {
      const unit = unitWidthRef.current;
      if (!unit) return;
      const max = container.scrollWidth - container.clientWidth;
      if (container.scrollLeft >= max - unit) container.scrollLeft -= unit;
      else if (container.scrollLeft <= unit) container.scrollLeft += unit;
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useAnimationFrame((_, delta) => {
    const container = containerRef.current;
    if (!playing || prefersReducedMotion || !container) return;
    container.scrollLeft += (delta / 1000) * SPEED_PX_PER_SEC;
  });

  const nudge = (direction: -1 | 1) => {
    setPlaying(false);
    containerRef.current?.scrollBy({ left: direction * NUDGE_PX, behavior: 'smooth' });
  };

  return (
    <div className="border-y border-line bg-surface-raised py-6">
      <div
        ref={containerRef}
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
            aria-label={playing ? 'Pause sponsor logo scroll' : 'Resume sponsor logo scroll'}
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
