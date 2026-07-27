import { cx } from '@/app/lib/cx';
import { describeFormGuide, type FormOutcome } from '@/app/lib/game-hub-form';

interface FormGuideProps {
  /** Outcomes oldest first, as `buildFormGuide` returns them. */
  form: readonly FormOutcome[];
  className?: string;
}

/**
 * The three chip styles, one per outcome.
 *
 * All three are semantic status tokens rather than the success/neutral pairing
 * `resultVariant` uses for a single result badge: in a strip of five glyphs a
 * neutral chip reads as "nothing here", and nothing-here already means
 * something specific — form is genuinely unavailable. A loss has to look like a
 * loss, and a draw like a third thing, so that an absent chip can look absent.
 *
 * `--warning` is the third status token the theme already defines, tuned for
 * both themes the same way success and danger are (#fbbf24 on the dark surface,
 * #b45309 on light), so the draw chip clears AA in both without a new colour
 * entering the palette. Colour is never the only carrier anyway: the letter
 * inside the chip is what states the outcome, and it is what the screen-reader
 * sentence below reads out.
 *
 * The loss chip reads `--danger-on-tint`, not `--danger`. Every other
 * `text-danger` on this site sits on a plain surface; these chips are the one
 * place a status colour is read against a tint of itself, and danger is the one
 * of the three too dark to survive that — #ef4444 on `bg-danger/15` over a
 * raised panel measures 4.03:1, under the 4.5:1 floor for 10px text. Success
 * (6.9:1) and warning (7.7:1) clear it unaided, so only danger is restated.
 */
const CHIP_STYLES: Record<FormOutcome, string> = {
  W: 'border-success/30 bg-success/15 text-success',
  L: 'border-danger/30 bg-danger/15 text-danger-on-tint',
  D: 'border-warning/30 bg-warning/15 text-warning',
};

/**
 * A school's recent results as W/L/D chips, oldest to newest left to right.
 *
 * The chips are hidden from assistive tech and replaced by one sentence, the
 * same treatment `ArchiveCommandDeck` gives its bar chart: five bare letters
 * announce as "W W L W W", which says neither what they are nor which end is
 * the most recent match.
 */
export default function FormGuide({ form, className }: FormGuideProps) {
  if (form.length === 0) {
    return (
      <span className={cx('text-foreground-muted', className)}>
        <span aria-hidden="true">&mdash;</span>
        <span className="sr-only">{describeFormGuide(form)}</span>
      </span>
    );
  }

  return (
    <span className={cx('inline-flex items-center gap-1', className)}>
      {form.map((outcome, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={cx(
            'inline-flex h-5 w-5 items-center justify-center rounded border text-[10px] font-black leading-none',
            CHIP_STYLES[outcome]
          )}
        >
          {outcome}
        </span>
      ))}
      <span className="sr-only">{describeFormGuide(form)}</span>
    </span>
  );
}
