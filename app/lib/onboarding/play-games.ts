const MAX_PLAY_GAMES = 20;

/**
 * Bounded list of unique id strings from untrusted input (a draft or a submission). The submit step
 * re-validates every id against the games table, so this only keeps the shape sane.
 */
export function sanitizeGameIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value.filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64);
  return [...new Set(ids)].slice(0, MAX_PLAY_GAMES);
}
