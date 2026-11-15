import 'server-only';
import { HenrikMatchAdapter } from './henrik-adapter';
import type { MatchDataPort } from './types';

/**
 * The configured match data source. The key comes from `VALORANTAPI` and is read only on the
 * server at call time; it is never passed to a client component, returned from an action or
 * logged. An unset key yields an adapter that reports `misconfigured` rather than throwing, so
 * the portal degrades to "ask an admin" and manual entry keeps working.
 */
export function getMatchDataPort(): MatchDataPort {
  return new HenrikMatchAdapter({ apiKey: process.env.VALORANTAPI ?? '' });
}
