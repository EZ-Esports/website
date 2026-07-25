import { cx } from '@/app/lib/cx';
import { describeFormGuide, type FormOutcome } from '@/app/lib/game-hub-form';

interface FormGuideProps {
  /** Outcomes oldest first, as `buildFormGuide` returns them. */
  form: readonly FormOutcome[];
  className?: string;
}

/**
 * A school's recent results as W/L chips, oldest to newest left to right.
 *
 * Win and loss are the two semantic status tokens rather than success/neutral
 * (the pairing `resultVariant` uses for a single result badge): in a strip of
 * five glyphs a neutral chip reads as "nothing here", and nothing-here already
 * means something specific — form is genuinely unavailable. A loss has to look
 * like a loss so that an absent chip can look absent.
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
            outcome === 'W'
              ? 'border-success/30 bg-success/15 text-success'
              : 'border-danger/30 bg-danger/15 text-danger'
          )}
        >
          {outcome}
        </span>
      ))}
      <span className="sr-only">{describeFormGuide(form)}</span>
    </span>
  );
}
