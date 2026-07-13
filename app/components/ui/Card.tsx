import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { cx } from '@/app/lib/cx';

type CardVariant = 'raised' | 'tinted';
type CardPadding = 'sm' | 'md' | 'lg';

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  children: ReactNode;
  /** 'raised' = the dominant dark panel look (match cards, standings shell). 'tinted' = accent-tinted highlight panel. */
  variant?: CardVariant;
  /** Pink left accent bar, e.g. league-pulse list rows. */
  accent?: boolean;
  /** Adds hover affordances (border/translate) for clickable cards. */
  interactive?: boolean;
  padding?: CardPadding;
  className?: string;
}

const variantStyles: Record<CardVariant, string> = {
  raised: 'bg-surface-raised/60 border border-line',
  tinted: 'bg-accent/10 border border-accent/20',
};

const paddingStyles: Record<CardPadding, string> = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export default function Card({
  as: Component = 'div',
  children,
  variant = 'raised',
  accent = false,
  interactive = false,
  padding = 'md',
  className = '',
  ...props
}: CardProps) {
  return (
    <Component
      className={cx(
        'rounded-2xl shadow-2xl shadow-black/20 transition-all duration-300',
        variantStyles[variant],
        paddingStyles[padding],
        accent && 'border-l-4 border-l-accent',
        interactive && 'hover:border-accent/50 hover:-translate-y-0.5 cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
