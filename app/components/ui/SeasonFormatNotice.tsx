import Card from '@/app/components/ui/Card';
import Badge from '@/app/components/ui/Badge';
import { cx } from '@/app/lib/cx';

interface SeasonFormatNoticeProps {
  /** Override the default bottom margin when the notice sits below its table. */
  className?: string;
}

/**
 * Shown above (or below) a `combined` season's standings, where the table lists
 * a school once per squad and the Varsity/JV switch is gone.
 *
 * It exists because the table looks wrong to a reader who assumes the site's
 * usual two divisions: one table containing both labels, with some school names
 * appearing twice.
 *
 * Every claim here restates what `standings_format = 'combined'` *means* — one
 * table, and a Varsity/JV label that names a squad rather than a bracket — so it
 * is true of any season the pipeline declares in `COMBINED_STANDINGS`, not just
 * 2023-24 League of Legends. That list is deliberately extensible, and this
 * component takes no season, so nothing here may depend on one: a per-season
 * fact (a field size, a fixture count, a number of two-squad schools) would be
 * published as a fact about the next declared season too, with nothing to catch
 * it. Nor is anything inferred from the rows below — the format is a declared
 * field precisely because reading the pipeline's own output back is what
 * fabricated the split this notice explains.
 *
 * Same shape as `MigrationNotice`: a tinted `Card` with a `Badge` label and one
 * explanatory sentence, so the two read as one family of page-level notices.
 * The badge is `neutral`, not `warning` — nothing is wrong here, the reader is
 * just owed the format.
 */
export default function SeasonFormatNotice({ className = 'mb-8' }: SeasonFormatNoticeProps) {
  return (
    <Card
      variant="tinted"
      padding="sm"
      className={cx(
        'flex flex-col sm:flex-row sm:items-center gap-3 bg-accent/5 border-accent/20',
        className
      )}
    >
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="neutral" size="sm" className="font-black">
          Combined table
        </Badge>
      </div>
      <p className="text-xs text-foreground-secondary font-semibold leading-relaxed">
        Varsity and JV squads competed in a{' '}
        <span className="text-foreground font-black">single table</span> this season, so a school
        that entered two squads appears once for each. Varsity and JV name the squad a school
        entered, not a separate division.
      </p>
    </Card>
  );
}
