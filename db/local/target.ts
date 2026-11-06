import { assertSeedTargetAllowed, seedTargetHost } from '../seed-target';

/**
 * The only database the local-dev scripts will write to. It is `LOCAL_DATABASE_URL` (or the default
 * loopback URL of `npm run db:local:start`), never `DATABASE_URL`: these scripts are run without
 * `--env-file`, and `.env` here is the production connection string. Even an explicit remote
 * `LOCAL_DATABASE_URL` plus `SEED_ALLOW_REMOTE` is refused: this is a loopback-only toolchain.
 */
export const DEFAULT_LOCAL_URL = 'postgres://postgres:postgres@127.0.0.1:54329/postgres';

export function requireLocalUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.LOCAL_DATABASE_URL?.trim() || DEFAULT_LOCAL_URL;
  const host = seedTargetHost(url);
  if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') {
    throw new Error(
      `Refusing ${host ?? 'an unreadable host'}: local-dev scripts only talk to a loopback database (127.0.0.1 / localhost).`,
    );
  }
  assertSeedTargetAllowed(url); // the repo-wide gate, too: loopback passes without SEED_ALLOW_REMOTE
  return url;
}
