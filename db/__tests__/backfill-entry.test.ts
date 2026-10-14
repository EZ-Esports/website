import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

/**
 * Unit tests import the planning module, never the script, so a launch crash in
 * the real entry point (app/lib/db/schema.ts imports `server-only`, which throws
 * under plain tsx) went unnoticed. This runs the actual entry point exactly as the
 * npm script does (minus --env-file, so no .env is ever read) with an empty
 * environment: it must get far enough to hit its own configuration guard. With no
 * DATABASE_URL or Supabase variables it cannot connect to anything.
 */
const root = resolve(__dirname, '..', '..');
const tsxCli = join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const entry = join(root, 'db', 'backfill-gallery-thumbnails.ts');

function run(extraArgs: string[]) {
  return spawnSync(process.execPath, [tsxCli, ...extraArgs, entry, '--bucket=admin-uploads'], {
    cwd: root,
    env: { PATH: process.env.PATH ?? '', SystemRoot: process.env.SystemRoot ?? '' } as unknown as NodeJS.ProcessEnv,
    encoding: 'utf8',
    timeout: 60_000,
  });
}

describe('db:backfill:gallery-thumbnails entry point', () => {
  it('loads its module graph under --conditions=react-server and stops at its own guard', () => {
    const result = run(['--conditions=react-server']);
    const output = `${result.stdout}${result.stderr}`;
    expect(output).not.toMatch(/server-only|Client Component|cannot be imported/i);
    expect(output).toMatch(/\[gallery-thumbs\] Fatal: .*refusing/i);
    expect(result.status).toBe(1);
  }, 70_000);

  it('the npm script passes the react-server condition', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require(join(root, 'package.json')) as { scripts: Record<string, string> };
    expect(pkg.scripts['db:backfill:gallery-thumbnails']).toContain('--conditions=react-server');
  });
});
