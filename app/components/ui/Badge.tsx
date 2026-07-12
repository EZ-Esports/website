import type { ReactNode } from 'react';
import { cx } from '@/app/lib/cx';

export type BadgeVariant = 'accent' | 'success' | 'neutral' | 'warning';
export type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  size?: BadgeSize;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  accent: 'bg-accent/10 border-accent/20 text-accent',
  success: 'bg-success/10 border-success/20 text-success',
  neutral: 'bg-surface-raised border-line text-foreground-secondary',
  warning: 'bg-warning/10 border-warning/20 text-warning',
};

const dotStyles: Record<BadgeVariant, string> = {
  accent: 'bg-accent',
  success: 'bg-success',
  neutral: 'bg-foreground-muted',
  warning: 'bg-warning',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'text-[10px] px-2 py-0.5 rounded-md gap-1',
  md: 'text-xs px-3 py-1 rounded-full gap-1.5',
};

export default function Badge({ children, variant = 'accent', dot = false, size = 'md', className = '' }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center border font-black uppercase tracking-widest whitespace-nowrap',
        sizeStyles[size],
        variantStyles[variant],
        className
      )}
    >
      {dot && <span className={cx('w-1.5 h-1.5 rounded-full shrink-0', dotStyles[variant])} aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Match-result chip color: a win reads as success, a loss stays neutral (no longer accent-pink). */
export function resultVariant(won: boolean): 'success' | 'neutral' {
  return won ? 'success' : 'neutral';
}
