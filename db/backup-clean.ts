/**
 * Manual entry point for `pruneLocalBackups()` (db/backup.ts).
 *
 * Every `requireFreshBackup()` call already prunes as its last step, so this
 * is not required for `db/backups/` to stay bounded — it exists for someone
 * who wants to reclaim the space without running a seed or migration.
 * Doesn't touch the database, so no `--env-file-if-exists=.env` in its npm
 * script.
 */
import { pruneLocalBackups } from './backup';

const deleted = pruneLocalBackups();

if (deleted.length === 0) {
  console.log('db/backups/: nothing to prune.');
} else {
  console.log(`db/backups/: pruned ${deleted.length} old backup(s):`);
  for (const name of deleted) console.log(`  ${name}`);
}
