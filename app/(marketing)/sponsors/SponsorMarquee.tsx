'use client';

import Image from 'next/image';
import { animate, motion, useAnimationFrame, useMotionValue } from 'framer-motion';
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

const controlButtonClass =
  'flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-foreground-secondary transition-all duration-300 hover:border-accent/60 hover:bg-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised';

export default function SponsorMarquee({ sponsors }: { sponsors: MarqueeSponsor[] }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [playing, setPlaying] = useState(!prefersReducedMotion);
  const x = useMotionValue(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const halfWidthRef = useRef(0);
  const doubled = [...sponsors, ...sponsors];

  useEffect(() => {
    if (trackRef.current) {
      halfWidthRef.current = trackRef.current.scrollWidth / 2;
    }
  }, [sponsors]);

  useAnimationFrame((_, delta) => {
    if (!playing || prefersReducedMotion) return;
    const half = halfWidthRef.current;
    if (!half) return;
    let next = x.get() - (delta / 1000) * SPEED_PX_PER_SEC;
    if (next <= -half) next += half;
    x.set(next);
  });

  const nudge = (direction: -1 | 1) => {
    setPlaying(false);
    const half = halfWidthRef.current;
    let target = x.get() + direction * NUDGE_PX;
    if (half) {
      if (target > 0) target -= half;
      if (target <= -half) target += half;
    }
    animate(x, target, { duration: 0.4, ease: 'easeOut' });
  };

  return (
    <div className="border-y border-line bg-surface-raised py-6">
      <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_3%,black_97%,transparent)]">
        <motion.div ref={trackRef} style={{ x }} className="flex w-max items-center gap-10 px-6">
          {doubled.map((item, i) => (
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
        </motion.div>
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
