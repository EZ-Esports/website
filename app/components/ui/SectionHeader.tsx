import type { ReactNode } from 'react';
import { cx } from '@/app/lib/cx';
import GradientRule from './GradientRule';

interface EyebrowProps {
  children: ReactNode;
  className?: string;
}

export function Eyebrow({ children, className = '' }: EyebrowProps) {
  return (
    <span className={cx('inline-block text-accent uppercase tracking-widest text-xs font-bold', className)}>
      {children}
    </span>
  );
}

type HeadingLevel = 'h1' | 'h2' | 'h3';

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  lead?: string;
  align?: 'left' | 'center';
  as?: HeadingLevel;
  className?: string;
}

const alignStyles = {
  left: 'text-left',
  center: 'text-center',
};

const headingSizeByLevel: Record<HeadingLevel, string> = {
  h1: 'text-4xl sm:text-5xl md:text-6xl',
  h2: 'text-3xl sm:text-4xl md:text-5xl',
  h3: 'text-2xl sm:text-3xl md:text-4xl',
};

export function SectionHeader({ eyebrow, title, lead, align = 'center', as: Heading = 'h2', className = '' }: SectionHeaderProps) {
  return (
    <div className={cx(alignStyles[align], 'mb-12', className)}>
      {eyebrow && (
        <Eyebrow className="mb-3 block">{eyebrow}</Eyebrow>
      )}
      <Heading className={cx('font-black tracking-tight text-foreground', headingSizeByLevel[Heading])}>
        {title}
      </Heading>
      <GradientRule center={align === 'center'} className="mt-4" />
      {lead && (
        <p className={cx('mt-4 text-foreground-secondary text-base sm:text-lg leading-relaxed max-w-2xl', align === 'center' && 'mx-auto')}>
          {lead}
        </p>
      )}
    </div>
  );
}
