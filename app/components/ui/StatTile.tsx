import type { ReactNode } from 'react';
import { cx } from '@/app/lib/cx';
import Card from './Card';

interface StatTileProps {
  value: ReactNode;
  label: string;
  className?: string;
}

/** A record/stat callout tile, e.g. the season-record cards on the game hub pages. */
export default function StatTile({ value, label, className = '' }: StatTileProps) {
  return (
    <Card interactive className={cx('text-center', className)}>
      <div className="text-4xl font-black text-accent mb-2">{value}</div>
      <div className="text-foreground-muted text-xs font-bold uppercase tracking-wider">{label}</div>
    </Card>
  );
}
