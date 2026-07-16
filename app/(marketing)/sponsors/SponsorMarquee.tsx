'use client';

import Image from 'next/image';
import { motion, useAnimationControls } from 'framer-motion';
import { useEffect, useState } from 'react';
import { usePrefersReducedMotion } from '@/app/lib/hooks/usePrefersReducedMotion';

interface MarqueeSponsor {
  id: string;
  name: string;
  logoUrl: string | null;
}

function MarqueeColumn({
  items,
  reverse,
  playing,
  prefersReducedMotion,
}: {
  items: MarqueeSponsor[];
  reverse: boolean;
  playing: boolean;
  prefersReducedMotion: boolean;
}) {
  const controls = useAnimationControls();
  const doubled = [...items, ...items];

  useEffect(() => {
    if (prefersReducedMotion) return;
    if (playing) {
      controls.start({
        y: reverse ? ['-50%', '0%'] : ['0%', '-50%'],
        transition: { duration: reverse ? 22 : 18, repeat: Infinity, ease: 'linear' },
      });
    } else {
      controls.stop();
    }
  }, [playing, reverse, controls, prefersReducedMotion]);

  return (
    <div className="relative h-full flex-1 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_88%,transparent)]">
      <motion.div animate={controls} className="flex flex-col gap-4">
        {doubled.map((item, i) => (
          <div
            key={`${item.id}-${i}`}
            className="flex h-16 items-center justify-center rounded-xl border border-line bg-surface px-3 text-center"
          >
            {item.logoUrl ? (
              <Image
                src={item.logoUrl}
                alt={`${item.name} logo`}
                width={120}
                height={40}
                className="h-8 w-auto object-contain opacity-90"
              />
            ) : (
              <span className="text-xs font-extrabold uppercase tracking-wide text-foreground-muted">
                {item.name}
              </span>
            )}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

export default function SponsorMarquee({ sponsors }: { sponsors: MarqueeSponsor[] }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [playing, setPlaying] = useState(true);

  const mid = Math.ceil(sponsors.length / 2);
  const colA = sponsors.slice(0, mid);
  const colBRaw = sponsors.slice(mid);
  const colB = colBRaw.length > 0 ? colBRaw : colA;

  return (
    <div className="relative flex h-[340px] gap-4 border-l border-line bg-surface-raised p-5 lg:h-[440px]">
      <MarqueeColumn items={colA} reverse={false} playing={playing} prefersReducedMotion={prefersReducedMotion} />
      <MarqueeColumn items={colB} reverse={true} playing={playing} prefersReducedMotion={prefersReducedMotion} />
      {!prefersReducedMotion && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
          <button
            type="button"
            onClick={() => setPlaying(false)}
            disabled={!playing}
            aria-label="Pause sponsor logo scroll"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface text-foreground-secondary transition-all duration-300 hover:border-accent/60 hover:bg-surface-raised disabled:cursor-default disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setPlaying(true)}
            disabled={playing}
            aria-label="Resume sponsor logo scroll"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface text-foreground-secondary transition-all duration-300 hover:border-accent/60 hover:bg-surface-raised disabled:cursor-default disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M7 5l12 7-12 7V5z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
