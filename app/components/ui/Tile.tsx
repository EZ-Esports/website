import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx } from '@/app/lib/cx';
import { panelShell, panelSurfaces } from '@/app/components/ui/Card';

export type TileTone = 'default' | 'accent' | 'feature';

/**
 * The `accent` and `feature` tones read the per-game CSS custom properties
 * (`--game-accent-soft` / `--game-accent-strong` / `--game-accent-line`) that
 * the game hub sets as an inline style on its page container. Outside such a
 * container they degrade to a transparent panel, so only use them under a
 * themed ancestor. `feature` is the dominant tile of a grid: a stronger tint
 * plus a solid accent edge.
 */
const toneStyles: Record<TileTone, string> = {
  default: panelSurfaces.raised,
  accent: 'bg-[var(--game-accent-soft)] border border-[var(--game-accent-line)]',
  feature:
    'bg-[var(--game-accent-strong)] border border-[var(--game-accent-line)] border-l-4 border-l-[var(--game-accent)]',
};

/**
 * The title is 11px, which is never "large text" for WCAG, so it needs the
 * full 4.5:1. `foreground-muted` measures 3.69:1 on the plain raised panel and
 * worse on an accent-tinted one — it fails everywhere here. Hence
 * `foreground-secondary` (~7:1) on every tone, which still reads a clear step
 * below the tile content because the title is smaller and the body is
 * `foreground`. One value for all tones, deliberately: a per-tone record here
 * would imply the tones may diverge, and contrast says they can't.
 */
const titleStyle = 'text-foreground-secondary';

interface TileProps {
  /** The single question this tile answers, rendered as its heading. */
  title: string;
  /** Page that answers the question in full. Renders the header jump-off link. */
  href?: string;
  /** Label for that link — the arrow is appended automatically. */
  linkLabel?: string;
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
  tone = 'default',
  flush = false,
  className = '',
  children,
}: TileProps) {
  return (
    <article
      className={cx(
        'flex flex-col',
        panelShell,
        toneStyles[tone],
        // Only a tile that actually goes somewhere gets a hover affordance —
        // a border that brightens on a tile with nothing to click is a lie.
        href && tone === 'default' && 'hover:border-foreground-muted',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-3">
        <h2 className={cx('text-[11px] font-black uppercase tracking-widest', titleStyle)}>
          {title}
        </h2>
        {href && (
          // The focus ring falls back to the global accent token: an undefined
          // custom property invalidates the whole `box-shadow` declaration, so
          // a bare `var(--game-accent)` means *no ring at all* — not a default
          // colour — for any Tile rendered outside a themed ancestor.
          <Link
            href={href}
            className="-my-3 inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-sm text-[11px] font-black uppercase tracking-widest text-foreground-secondary transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--game-accent,var(--accent))] focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
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
