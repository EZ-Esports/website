import type { ReactNode } from 'react';
import { cx } from '@/app/lib/cx';

type SectionTone = 'default' | 'raised' | 'sunken';
type SectionWidth = 'default' | 'narrow' | 'wide';

interface SectionProps {
  tone?: SectionTone;
  width?: SectionWidth;
  children: ReactNode;
  className?: string;
}

const toneStyles: Record<SectionTone, string> = {
  default: 'bg-surface',
  raised: 'bg-surface-raised',
  sunken: 'bg-surface-sunken',
};

const widthStyles: Record<SectionWidth, string> = {
  default: 'max-w-6xl',
  narrow: 'max-w-4xl',
  wide: 'max-w-7xl',
};

/** Section shell owning the site's vertical rhythm (py-16 md:py-24) and container width. */
export default function Section({ tone = 'default', width = 'default', children, className = '' }: SectionProps) {
  return (
    <section className={cx(toneStyles[tone], 'py-16 md:py-24 relative z-10', className)}>
      <div className={cx('container mx-auto px-4', widthStyles[width])}>
        {children}
      </div>
    </section>
  );
}
