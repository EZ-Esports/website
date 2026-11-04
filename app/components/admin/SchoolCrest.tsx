import { cx } from '@/app/lib/cx';

const SIZES = {
  sm: 'h-8 w-8 rounded-md text-xs',
  lg: 'h-14 w-14 rounded-xl text-base',
} as const;

/**
 * A school's crest as the staff area shows it (Schools & Rosters rows, season school cards): the
 * uploaded logo when there is one, otherwise the school's first two letters on a neutral tile.
 */
export default function SchoolCrest({
  name,
  logoUrl,
  size = 'sm',
  className,
}: {
  name: string;
  logoUrl: string | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return logoUrl ? (
    // Logos are arbitrary uploaded assets of unknown size; a plain img keeps them unoptimised and contained.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt={`${name} logo`} className={cx(SIZES[size], 'shrink-0 object-contain bg-surface-raised', className)} />
  ) : (
    <div
      aria-hidden
      className={cx(SIZES[size], 'flex shrink-0 items-center justify-center bg-surface-raised font-semibold text-foreground-secondary', className)}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}
