/**
 * Which database a destructive seed is allowed to wipe.
 *
 * `requireFreshBackup()` (db/backup.ts) makes sure there is something to go
 * back to. This is the other half: making sure the seed is pointed somewhere it
 * is supposed to be pointed at all. A backup of the wrong database taken just
 * before wiping it is not much comfort.
 *
 * Both incidents came from the same shape — `npm run db:seed:gold` reads
 * `.env`, and `.env` on the machine the seed is usually run from holds the
 * production connection string. Nothing had to go wrong for the seed to hit
 * production; that was the default, and the only thing standing between a
 * routine season import and a live wipe was the operator remembering.
 *
 * So: loopback targets run freely, and anything else has to be named. Setting
 * `SEED_ALLOW_REMOTE` to the exact host being seeded is the opt-in — not `1`,
 * not `true`, the host itself. A blanket value is the kind of thing that ends
 * up exported in a shell profile and then silently authorises every future run;
 * naming the host means the authorisation cannot outlive the database it was
 * meant for, and cannot be given by accident.
 *
 * Fails closed. A connection string this cannot read the host out of is treated
 * as remote and needs the same opt-in, because "I could not tell" and "it is
 * local" must not be the same answer.
 */

/** Set to the exact host being seeded to authorise a non-loopback target. */
export const ALLOW_REMOTE_ENV = 'SEED_ALLOW_REMOTE';

/**
 * Hosts that are this machine. Loopback only — deliberately not
 * `host.docker.internal` or a LAN address, which are as capable of holding
 * something irreplaceable as any cloud host.
 */
function isLoopback(host: string): boolean {
  if (host === 'localhost' || host === '::1') return true;
  // The whole 127.0.0.0/8 block, not just 127.0.0.1.
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
}

/**
 * The host a libpq connection string points at, or `undefined` when that cannot
 * be determined — which callers must treat as remote, not as local.
 *
 * `undefined` is not the same as "no host". A connection string with no host at
 * all (a bare database name, or a URI with an empty authority) is libpq's local
 * Unix socket, which is genuinely local and comes back as `'localhost'`.
 */
export function seedTargetHost(url: string): string | undefined {
  const trimmed = url.trim();
  if (trimmed === '') return undefined;

  // libpq keyword/value DSN: `host=db.example.com port=5432 dbname=app`.
  // Checked before the URI parse because it has no scheme and would otherwise
  // fall through to the "unparseable" branch below.
  if (/^\s*\w+\s*=/.test(trimmed)) {
    const match = /(?:^|\s)host\s*=\s*('[^']*'|\S+)/i.exec(trimmed);
    if (!match) return 'localhost'; // no host= means the local socket
    const host = match[1].replace(/^'|'$/g, '');
    // A socket directory rather than a hostname.
    if (host.startsWith('/')) return 'localhost';
    return host.toLowerCase();
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    // Not a URI and not a DSN. A bare database name is local, but so is any
    // typo, and we cannot tell them apart — so say we don't know.
    return undefined;
  }

  if (!/^postgres(ql)?:$/i.test(parsed.protocol)) return undefined;

  // Multi-host strings (`h1:5432,h2:5432`) parse, but `URL` keeps only the
  // first host and puts the rest in the port. Refuse to guess which one the
  // seed would reach.
  if (parsed.port !== '' && !/^\d+$/.test(parsed.port)) return undefined;

  const hostname = decodeURIComponent(parsed.hostname);
  if (hostname === '') return 'localhost'; // `postgresql:///app` — local socket
  if (hostname.startsWith('/')) return 'localhost'; // percent-encoded socket dir

  // `URL` keeps IPv6 literals in their brackets; the comparison wants the address.
  return hostname.replace(/^\[|\]$/g, '').toLowerCase();
}

/**
 * Throws unless the seed is pointed at loopback, or the caller has explicitly
 * named this host in `SEED_ALLOW_REMOTE`.
 *
 * Call this before taking a backup, not after: a refused run should not spend
 * a minute dumping the database it is about to refuse to touch.
 */
export function assertSeedTargetAllowed(url = process.env.DATABASE_URL): void {
  if (!url) {
    throw new Error('DATABASE_URL is not set — refusing to seed.');
  }

  const host = seedTargetHost(url);
  if (host !== undefined && isLoopback(host)) return;

  const allowed = process.env[ALLOW_REMOTE_ENV]?.trim();
  if (host !== undefined && allowed === host) return;

  const target = host ?? 'an unrecognised host';
  const named = host ?? '<the host>';

  if (allowed && host !== undefined) {
    throw new Error(
      `${ALLOW_REMOTE_ENV} is set to ${JSON.stringify(allowed)} but DATABASE_URL ` +
        `points at ${host}. This seed deletes and re-inserts whole tables. ` +
        'Refusing to run against a host that was not the one authorised.'
    );
  }

  throw new Error(
    `DATABASE_URL points at ${target}, which is not loopback. This seed deletes ` +
      'and re-inserts whole tables, and has twice destroyed live data.\n\n' +
      'If that is genuinely what you want, name the host:\n\n' +
      `  ${ALLOW_REMOTE_ENV}=${named} npm run <the seed script>\n\n` +
      'Take a backup you have restored from before you do.'
  );
}
