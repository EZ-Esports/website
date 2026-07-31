/**
 * Imports staff from the archive into `leadership`.
 *
 * Reads gold_data/gold_leadership.csv, which sharepoint/normalize_gold.py
 * exports from the ledger's People tab, and merges it into the table. It is the
 * route back for the 70 staff rows a seed destroyed on 2026-07-30 — the export
 * they originally came from was never committed and no longer exists, so those
 * people return only as the People tab is filled in.
 *
 * Merges, never replaces. Every rule lives in db/leadership-merge.ts: rows are
 * matched on (name, role, year), missing ones are added, blank bios are filled,
 * and nothing is ever overwritten or deleted. Running this twice changes nothing
 * the second time, so it is safe to re-run after each edit to the sheet.
 *
 * name and role are composed HERE rather than in the Python exporter, with the
 * same displayName()/formatRole() that produced the 99 rows already in the
 * table. Two implementations of those rules would only have to drift by a space
 * for the merge to stop matching and start inserting duplicates.
 *
 * Run: npm run db:seed:leadership   (add --dry-run to see the plan only)
 */
import { existsSync } from 'fs';
import { resolve } from 'path';
import { readRecords, toLeadershipRecords } from './import-archive';
import { mergeLeadership, dedupeRecords } from './leadership-merge';
import { assertSeedTargetAllowed } from './seed-target';

const GOLD_CSV = 'sharepoint/gold_data/gold_leadership.csv';

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  // Adds rows and fills blanks; it cannot delete or overwrite. The interlock is
  // here anyway, because "this one is safe" is how the other two seeds were
  // described before they destroyed data.
  if (!dryRun) assertSeedTargetAllowed();

  const path = resolve(process.cwd(), GOLD_CSV);
  if (!existsSync(path)) {
    throw new Error(
      `${GOLD_CSV} not found. Generate it first: from sharepoint/, run ` +
        '`python3 main.py` to refresh bronze, then `python3 normalize_gold.py`.'
    );
  }

  const records = toLeadershipRecords(readRecords(GOLD_CSV));
  console.log(`Read ${records.length} staff record(s) from ${GOLD_CSV}`);

  if (records.length === 0) {
    console.log(
      'Nothing to import. The ledger People tab needs First/Last, Division or\n' +
        'Position, and Years Active filled in before a person can be represented —\n' +
        'normalize_gold.py lists exactly who is missing what.'
    );
    return;
  }

  if (dryRun) {
    const { unique, collapsed } = dedupeRecords(records);
    console.log(`\n${unique.length} distinct (name, role, year) record(s):`);
    for (const r of unique) console.log(`  ${r.year}  ${r.name} — ${r.role}`);
    for (const c of collapsed) console.log(`  note: collapsed duplicate ${c}`);
    console.log('\n--dry-run: nothing written.');
    return;
  }

  const result = await mergeLeadership(records);
  for (const note of result.notes) console.log(`  note: ${note}`);
  console.log(
    `\n${result.inserted} added, ${result.updated} bio(s) filled, ` +
      `${result.skipped} left as they were.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Leadership import failed:', err);
    process.exit(1);
  });
