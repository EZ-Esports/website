'use client';

import { Link } from 'react-aria-components';
import type { ReactNode } from 'react';
import { cx } from '@/app/lib/cx';

interface CutCTAProps {
  href: string;
  variant?: 'primary' | 'outline';
  size?: 'md' | 'sm';
  external?: boolean;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
  onPress?: () => void;
}

/**
 * Shared clipped-corner CTA button (RAC Link) used by the hero and the nav's
 * Apply Now, so every "action" button on the site reads as one coherent
 * shape/weight/casing. A plain CSS `border` only draws along an element's
 * rectangular box edges — once `clip-path` shaves off the diagonal corners,
 * the border has no edge left to follow there, leaving the cut looking
 * open. So the border is a second, 1px-larger clipped layer stacked behind
 * the fill layer instead of a `border` property, which draws all the way
 * around the hexagon including the diagonal cuts.
 */
const CLIP = '[clip-path:polygon(14px_0,100%_0,100%_calc(100%-14px),calc(100%-14px)_100%,0_100%,0_14px)]';

const edgeStyles: Record<'primary' | 'outline', string> = {
  primary: 'bg-accent group-hover:bg-white',
  outline: 'bg-foreground/30 group-hover:bg-accent',
};

const fillStyles: Record<'primary' | 'outline', string> = {
  primary: 'bg-accent group-hover:bg-white',
  outline: 'bg-white/[0.04] group-hover:bg-white/[0.08]',
};

const textStyles: Record<'primary' | 'outline', string> = {
  primary: 'text-on-accent',
  outline: 'text-foreground',
};

const sizeStyles: Record<'md' | 'sm', string> = {
  md: 'px-6 py-[13px] text-sm',
  sm: 'px-5 py-2.5 text-sm',
};

export default function CutCTA({
  href,
  variant = 'primary',
  size = 'md',
  external = false,
  icon,
  className = '',
  children,
  onPress,
}: CutCTAProps) {
  return (
    <Link
      href={href}
      onPress={onPress}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={cx('group relative inline-flex cursor-pointer focus:outline-none', className)}
    >
      {/* Edge layer: the full clipped hexagon, in the border color. Also carries
          the focus ring (inset, so it survives clip-path — see HomeHero CTA fix). */}
      <span
        className={cx(
          'absolute inset-0 transition-colors duration-200',
          CLIP,
          edgeStyles[variant],
          'group-focus-visible:ring-2 group-focus-visible:ring-inset group-focus-visible:ring-on-accent',
        )}
        aria-hidden="true"
      />
      {/* Fill layer: inset 1px, revealing the edge layer as a ring all the way
          around, including the diagonal corners. */}
      <span
        className={cx('absolute inset-[1px] transition-colors duration-200', CLIP, fillStyles[variant])}
        aria-hidden="true"
      />
      <span
        className={cx(
          'relative z-10 flex w-full items-center justify-center gap-2 font-extrabold',
          textStyles[variant],
          sizeStyles[size],
        )}
      >
        {icon}
        {children}
      </span>
    </Link>
  );
}
