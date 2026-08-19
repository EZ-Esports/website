/**
 * Manual entry point for `pruneLocalBackups()` — every backup already prunes
 * itself after writing, this is just for reclaiming space on demand.
 */
import { pruneLocalBackups } from './backup';

const deleted = pruneLocalBackups();

if (deleted.length === 0) {
  console.log('db/backups/: nothing to prune.');
} else {
  console.log(`db/backups/: pruned ${deleted.length} old backup(s):`);
  for (const name of deleted) console.log(`  ${name}`);
}
