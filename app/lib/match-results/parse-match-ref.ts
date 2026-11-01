/**
 * Parsing of the match references a manager pastes: a bare match UUID or a tracker.gg match link.
 * Pure and dependency-free so malformed input is rejected before any API call is made.
 */

const UUID_SOURCE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const BARE_UUID_RE = new RegExp(`^${UUID_SOURCE}$`, 'i');
const TRACKER_PATH_RE = new RegExp(`^/valorant/match/(${UUID_SOURCE})(?:/.*)?$`, 'i');

/** A league series is best of 3; the third game is only played if the first two split. */
export const MIN_SERIES_GAMES = 2;
export const MAX_SERIES_GAMES = 3;

/**
 * Returns the lower-cased match UUID in `raw`, or null when it is neither a bare UUID nor a
 * `https://tracker.gg/valorant/match/<uuid>` link (a trailing path, query or fragment is fine).
 */
export function parseMatchReference(raw: string): string | null {
  const text = raw.trim();
  if (BARE_UUID_RE.test(text)) return text.toLowerCase();

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase();
  if (host !== 'tracker.gg' && host !== 'www.tracker.gg') return null;
  const match = TRACKER_PATH_RE.exec(url.pathname);
  return match ? match[1].toLowerCase() : null;
}

export interface ParsedMatchReferences {
  /** Distinct match ids, in the order given. */
  ids: string[];
  /** Human-readable problems; when non-empty the submission must not proceed. */
  errors: string[];
}

/** Splits pasted text on whitespace, commas and semicolons and parses every entry. */
export function parseMatchReferences(input: string): ParsedMatchReferences {
  const entries = input.split(/[\s,;]+/).filter(Boolean);
  const ids: string[] = [];
  const errors: string[] = [];

  if (entries.length === 0) {
    return { ids, errors: ['Paste at least two match IDs or tracker.gg match links.'] };
  }
  entries.forEach((entry, index) => {
    const id = parseMatchReference(entry);
    if (!id) {
      errors.push(`Entry ${index + 1} is not a match ID or a tracker.gg match link.`);
    } else if (ids.includes(id)) {
      errors.push(`Entry ${index + 1} repeats a match that is already listed.`);
    } else {
      ids.push(id);
    }
  });
  if (errors.length === 0 && ids.length < MIN_SERIES_GAMES) {
    errors.push('A best-of-3 needs at least 2 games.');
  }
  if (errors.length === 0 && ids.length > MAX_SERIES_GAMES) {
    errors.push('A best-of-3 has at most 3 games.');
  }
  return { ids, errors };
}

export interface GameLinkValidation {
  /** One entry per game field: an error message, or null when the field is fine (or optional and empty). */
  fieldErrors: (string | null)[];
  /** The non-empty fields joined with newlines: the `input` the server action takes. */
  input: string;
  ok: boolean;
}

/**
 * Validates the per-game fields of the submit form (game 1 and 2 required, game 3 optional).
 * Each field holds exactly one bare UUID or tracker.gg link; repeats across fields are flagged on
 * the later field. The joined `input` still goes through the server's `parseMatchReferences`.
 */
export function validateGameLinks(values: string[]): GameLinkValidation {
  const seen: string[] = [];
  const fieldErrors = values.map((raw, index) => {
    const text = raw.trim();
    if (!text) {
      return index < MIN_SERIES_GAMES ? `Game ${index + 1} is required.` : null;
    }
    if (/[\s,;]/.test(text)) return `Game ${index + 1} takes a single match ID or link.`;
    const id = parseMatchReference(text);
    if (!id) return `Game ${index + 1} is not a match ID or a tracker.gg match link.`;
    if (seen.includes(id)) return `Game ${index + 1} repeats a match that is already listed.`;
    seen.push(id);
    return null;
  });
  return {
    fieldErrors,
    input: values.map((v) => v.trim()).filter(Boolean).join('\n'),
    ok: fieldErrors.every((e) => e === null),
  };
}
