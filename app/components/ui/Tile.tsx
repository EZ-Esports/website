import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx } from '@/app/lib/cx';

export type TileTone = 'default' | 'accent';

/**
 * The `accent` tone reads the per-game CSS custom properties
 * (`--game-accent-soft` / `--game-accent-line`) that the game hub sets as an
 * inline style on its page container. Outside such a container it degrades to
 * a transparent panel, so only use it under a themed ancestor.
 */
const toneStyles: Record<TileTone, string> = {
  default: 'bg-surface-raised/60 border-line hover:border-foreground-muted',
  accent: 'bg-[var(--game-accent-soft)] border-[var(--game-accent-line)]',
};

interface TileProps {
  /** The single question this tile answers, rendered as its heading. */
  title: string;
  /** Page that answers the question in full. Renders the header jump-off link. */
  href?: string;
  /** Label for that link — the arrow is appended automatically. */
  linkLabel?: string;
  external?: boolean;
  tone?: TileTone;
  /** Drop the body padding for content that carries its own (e.g. a Table). */
  flush?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * One cell of a bento grid: a labelled panel that answers exactly one question
 * and optionally links to the page answering it fully. Sibling of `Card` — use
 * `Card` for free-form panels, `Tile` when the panel needs a titled header row.
 */
export default function Tile({
  title,
  href,
  linkLabel = 'View',
  external = false,
  tone = 'default',
  flush = false,
  className = '',
  children,
}: TileProps) {
  return (
    <article
      className={cx(
        'flex flex-col rounded-2xl border shadow-2xl shadow-black/20 transition-colors duration-300',
        toneStyles[tone],
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-3">
        <h2 className="text-[11px] font-black uppercase tracking-widest text-foreground-muted">
          {title}
        </h2>
        {href && (
          <Link
            href={href}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="-my-3 inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-sm text-[11px] font-black uppercase tracking-widest text-foreground-secondary transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            {linkLabel}
            <span aria-hidden="true">&rarr;</span>
          </Link>
        )}
      </div>
      <div className={cx('flex-1', flush ? 'pb-2' : 'px-6 pb-6')}>{children}</div>
    </article>
  );
}
