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
import { displayName, formatRole, readRecords, toLeadershipRecords } from './import-archive';
import { mergeLeadership, dedupeRecords, type LeadershipRecord } from './leadership-merge';
import { assertSeedTargetAllowed } from './seed-target';

const GOLD_CSV = 'sharepoint/gold_data/gold_leadership.csv';

/**
 * The original archived export, if it is still on disk.
 *
 * Different shape from the gold CSV — one `name`, one `role`, a `season_id`
 * rather than a year — because it predates the pipeline and was the direct
 * input to db/seed.ts. It is preferred when present: it is the file the 99
 * surviving rows were built from, so it reproduces them exactly and its 169
 * records cover the ~70 that a seed destroyed.
 *
 * Gitignored, and it must stay that way: it carries students' emails, Discord
 * handles, hometowns and graduation years, and this repository is public.
 */
const ARCHIVE_CSV = 'sharepoint/staff_completeroster.csv';

/**
 * Composed with the exact rules db/import-archive.ts applied when these rows
 * were first imported — same displayName, same formatRole, same season->year
 * truncation, same fun_fact-then-notes bio fallback. Any deviation would fail to
 * match the survivors and insert a second copy of all 99.
 */
function fromArchiveExport(rows: Record<string, string>[]): LeadershipRecord[] {
  return rows
    .filter((r) => r.name)
    .map((r) => ({
      name: displayName(r.name, r.preferred_name),
      role: formatRole(r.division, r.role),
      year: r.season_id.slice(0, 4),
      bio: r.fun_fact || r.notes || null,
      highSchool: r.high_school || r.highschool || null,
      university: r.university || r.college || null,
    }));
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  // Adds rows and fills blanks; it cannot delete or overwrite. The interlock is
  // here anyway, because "this one is safe" is how the other two seeds were
  // described before they destroyed data.
  if (!dryRun) assertSeedTargetAllowed();

  // The archived export wins when it is there: it is the file the surviving
  // rows came from, so it reproduces them exactly instead of approximating them.
  const useArchive = existsSync(resolve(process.cwd(), ARCHIVE_CSV));
  const source = useArchive ? ARCHIVE_CSV : GOLD_CSV;

  if (!existsSync(resolve(process.cwd(), source))) {
    throw new Error(
      `Neither ${ARCHIVE_CSV} nor ${GOLD_CSV} is present. For the gold CSV: from ` +
        'sharepoint/, run `python3 main.py` to refresh bronze, then ' +
        '`python3 normalize_gold.py`.'
    );
  }

  const rows = readRecords(source);
  const records = useArchive ? fromArchiveExport(rows) : toLeadershipRecords(rows);
  console.log(`Read ${records.length} staff record(s) from ${source}`);

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
