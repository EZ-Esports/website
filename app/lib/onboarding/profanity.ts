/**
 * Offensive-language screen for student- and manager-typed onboarding text (legal names, Riot IDs,
 * demographic answers, feedback, consent signature names).
 *
 * Pure and dependency-free: imported by client components (immediate feedback) and by the server
 * submission pipeline (enforcement). No DB, no 'server-only'.
 *
 * BEST-EFFORT LIST. The terms below are a starting point, grouped by language. They are not exhaustive:
 * they miss dialects, new slang, regional spellings and creative misspellings, and coverage is uneven
 * across languages (languages with no entry here are not screened at all). This is a first line of
 * defence, not a moderation system. Staff still review what students submit.
 *
 * How matching works:
 *   1. Normalize: lowercase, NFKD and strip diacritics, map letters such as ß, ø, æ, ı, and fold Cyrillic
 *      lookalikes to Latin (so mixed-script spellings match). Leetspeak digits and symbols map to
 *      letters (0 o, 1 i or l, 3 e, 4 a, 5 s, 7 t, 8 b, @ a, $ s, ! i, + t). Zero-width characters are dropped.
 *   2. Split into word tokens on any other character. Adjacent tokens inside one space-free chunk are joined
 *      as candidates ("f.u.c.k", "nigg-a", "nigg.er"), and runs of 1-2 letter tokens are joined across spaces
 *      ("f u c k"). Words longer than two letters are not joined across spaces, so "a bit children" passes.
 *   3. A token matches a WHOLE_WORD term exactly, or after collapsing repeated letters ("fuuuck" to "fuck").
 *   4. A token containing a SUBSTRING term also matches. Substring matching is reserved for long,
 *      unambiguous terms (e.g. "dumbass" inside "dumbasses"), so short terms never fire inside legitimate
 *      words. "ass" matches only as a whole word, which is why "class", "assess" and "Scunthorpe" pass.
 *   5. Tokens on the ALLOWLIST and phrases on the ALLOWED_PHRASES list are never flagged.
 *   6. Name fields and Riot IDs do not flag NAME_EXCEPTIONS (name fields only) or AMBIGUOUS_SHORT_TERMS
 *      (short foreign words that are also surnames or everyday words). Free text flags everything.
 *
 * Known gaps: masked spellings ("f**k"), spellings that split a word with a letter-looking symbol that is
 * not in the leet map, and any language or script not listed below.
 *
 * To extend: add the word to the right language group, written in plain lowercase letters (diacritics and
 * leetspeak are handled by normalization). Add it to SUBSTRING_TERMS only if it is unambiguous and at least
 * five letters. Then add a case to __tests__/profanity.test.ts for the new term, and for any ordinary word
 * it might catch. Keep allowlist entries specific.
 */

/** Terms by language. Each entry is a single word, written in plain lowercase letters. */
export const PROFANITY_TERMS_BY_LANGUAGE: Readonly<Record<string, readonly string[]>> = {
  english: [
    'fuck', 'fucker', 'fuckers', 'fucking', 'fucked', 'fucks', 'fuckin', 'motherfucker', 'motherfuckers',
    'motherfucking', 'fuk', 'fuks', 'fuq', 'fck', 'fvck', 'phuck', 'phuk', 'shit', 'shitty', 'shitting',
    'shitter', 'bullshit', 'bitch', 'bitches', 'bitching', 'bitchy', 'bytch', 'byatch', 'bastard', 'bastards', 'asshole', 'assholes', 'dumbass', 'dumbasses', 'jackass', 'asshat',
    'smartass', 'fatass', 'ass', 'arse', 'cunt', 'cunts', 'cock', 'cocks', 'cocksucker', 'dick', 'dicks',
    'dickhead', 'dickheads', 'prick', 'pricks', 'pussy', 'pussies', 'twat', 'wanker', 'wankers', 'bollocks',
    'slut', 'sluts', 'slutty', 'whore', 'whores', 'piss', 'pissed', 'tits', 'titties', 'titty', 'cum', 'jizz',
    'nigger', 'niggers', 'nigga', 'niggas', 'coon', 'coons', 'chink', 'chinks', 'gook', 'gooks', 'spic',
    'spics', 'kike', 'kikes', 'wetback', 'wetbacks', 'tranny', 'trannies', 'faggot', 'faggots', 'fag',
    'fags', 'dyke', 'dykes', 'retard', 'retards', 'retarded', 'spastic', 'paki', 'raghead', 'towelhead',
    'beaner', 'honky',
  ],
  spanish: [
    'puta', 'putas', 'puto', 'putos', 'mierda', 'cabron', 'cabrona', 'cabrones', 'pendejo', 'pendeja',
    'pendejos', 'chingar', 'chingada', 'chingado', 'hijueputa', 'maricon', 'maricona', 'maricones', 'culero',
    'culera', 'gilipollas', 'joder', 'verga', 'pinche', 'zorra', 'carajo', 'cojones', 'polla', 'follar',
  ],
  french: [
    'merde', 'putain', 'pute', 'putes', 'connard', 'connasse', 'salope', 'salopes', 'encule', 'enculee',
    'enculer', 'enfoire', 'salaud', 'salopard', 'batard', 'batarde', 'nique', 'niquer', 'fdp',
  ],
  german: [
    'scheisse', 'scheiss', 'arschloch', 'arsch', 'fotze', 'ficken', 'hurensohn', 'hure', 'wichser',
    'wichsen', 'schwuchtel', 'miststuck', 'nutte', 'spast',
  ],
  portuguese: [
    'porra', 'caralho', 'merda', 'puta', 'puto', 'foda', 'fodase', 'foder', 'buceta', 'cuzao', 'viado',
    'bosta', 'arrombado', 'krl',
  ],
  italian: [
    'cazzo', 'cazzata', 'merda', 'stronzo', 'stronza', 'stronzi', 'fottere', 'fottuto', 'fottuta',
    'vaffanculo', 'puttana', 'puttane', 'coglione', 'coglioni', 'bastardo', 'bastarda',
    'minchia', 'zoccola', 'frocio', 'froci',
  ],
  dutch: [
    'kut', 'klootzak', 'klootzakken', 'lul', 'lullen', 'hoer', 'hoeren', 'neuk', 'neuken', 'flikker',
    'flikkers', 'godverdomme', 'tering', 'mongool',
  ],
  russian: [
    'блядь', 'блять', 'бля', 'хуй', 'хуйня', 'хуев', 'нахуй', 'пизда', 'пиздец', 'пизды', 'пиздюк', 'ебать',
    'ебал', 'ебаный', 'ебаная', 'ебанутый', 'сука', 'суки', 'мудак', 'мудило', 'говно', 'ублюдок', 'шлюха',
    'пидор', 'пидорас',
  ],
  polish: [
    'kurwa', 'kurwy', 'chuj', 'chuja', 'chuje', 'pierdolic', 'pierdole', 'pizda', 'pizdy', 'jebac', 'jebany',
    'jebana', 'dziwka', 'suka', 'cipa', 'skurwysyn', 'skurwiel', 'kutas',
  ],
  turkish: [
    'amk', 'orospu', 'orospucocugu', 'siktir', 'sikerim', 'sikik', 'yarrak', 'kahpe', 'ibne',
    'pezevenk', 'pust', 'amcik',
  ],
  hindi_urdu: [
    'madarchod', 'behenchod', 'bhenchod', 'chutiya', 'chutiye', 'gandu', 'bsdk', 'bhosdike',
    'bhosdika',
  ],
};

/**
 * Terms that may also match inside a longer token. Only long, unambiguous terms: a short term such as
 * "ass" or "cock" would fire inside "class" or "Hancock". Entries must also appear in PROFANITY_TERMS_BY_LANGUAGE.
 */
const SUBSTRING_OK_TERMS: ReadonlySet<string> = new Set([
  'fuck', 'shit', 'bitch', 'asshole', 'dumbass', 'jackass', 'bullshit', 'nigger', 'nigga', 'faggot',
  'cocksucker', 'dickhead', 'arschloch', 'hurensohn', 'vaffanculo', 'enculer', 'motherfucker',
]);

/**
 * Whole tokens that are never flagged. Names and words that a squeeze or substring rule could touch, kept
 * explicit so a later term addition does not silently flag them. Locked in by tests.
 */
const ALLOWED_TOKENS: ReadonlySet<string> = new Set([
  // Surnames that contain a term as a substring.
  'dickson', 'dickinson', 'dickens', 'dickerson', 'hancock', 'cockburn', 'cockerell', 'cockrell',
  // Place and word collisions.
  'scunthorpe', 'penistone', 'essex', 'titan', 'titans', 'titanic', 'therapist', 'therapists',
  'mishit', 'mishits', 'shitake', 'shitakes', 'shiitake', 'shiitakes', 'cumberland', 'cumming',
  // Ordinary words that the "ass" family or the squeeze rule could touch.
  'assess', 'assessed', 'assessment', 'assessor', 'class', 'classic', 'classy', 'glass', 'bass', 'grass',
  'mass', 'pass', 'passage', 'massage', 'niggardly',
]);

/** Phrases (as token sequences) that are never flagged, for example a Latin honours phrase. */
const ALLOWED_PHRASES: ReadonlyArray<readonly string[]> = [
  ['cum', 'laude'],
  ['magna', 'cum', 'laude'],
  ['summa', 'cum', 'laude'],
  ['spic', 'and', 'span'],
];

/**
 * Real surnames and given names that exist in the WHOLE_WORD list. Exempt only in name fields
 * (legal first and last name, consent name fields); a Riot ID or free text still flags them.
 */
const NAME_EXCEPTIONS: ReadonlySet<string> = new Set(['dick', 'dyke', 'coon']);

/**
 * Short terms that are also ordinary surnames, given names or everyday words in their own language.
 * Flagged in free text (feedback, country, language, consent wording), but not in legal name fields or Riot IDs,
 * where a surname or handle is expected. Cost: a deliberately typed foreign insult in a name or handle passes.
 * Staff review of names and handles is the backstop for that case.
 */
const AMBIGUOUS_SHORT_TERMS: ReadonlySet<string> = new Set([
  'tering', 'kut', 'hoer', 'cipa', 'suka', 'pust', 'lul', 'puta', 'bosta', 'gandu', 'ibne', 'kahpe',
]);

/** Which fields a check runs against. Name fields and Riot IDs get the exemptions above; free text does not. */
function isExempt(term: string, kind: OffensiveCheckOptions['kind']): boolean {
  if (AMBIGUOUS_SHORT_TERMS.has(term)) return kind === 'name' || kind === 'handle';
  if (kind === 'name') return NAME_EXCEPTIONS.has(term);
  return false;
}

const MAX_JOINED_TOKENS = 8;
const MAX_JOINED_LENGTH = 32;
const MIN_SUBSTRING_LENGTH = 5;
const MIN_SQUEEZE_LENGTH = 4;

/** Lowercase letters are folded (Cyrillic lookalikes and special Latin letters). Keys are lowercase. */
const CHAR_FOLD: Readonly<Record<string, string>> = {
  'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'ø': 'o', 'đ': 'd', 'ð': 'd', 'ł': 'l', 'ı': 'i', 'þ': 'th',
  // Cyrillic letters that look like Latin ones, so mixed-script spellings fold to the same form.
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'і': 'i', 'ї': 'i', 'ѕ': 's', 'ј': 'j',
};

/** Leetspeak digits and symbols mapped to letters. "1" is handled separately (i or l). */
const LEET: Readonly<Record<string, string>> = {
  '0': 'o', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i', '+': 't',
};

export interface OffensiveMatch {
  /** The normalized token or term that matched. Never show this to the student. */
  term: string;
  /** Language group from PROFANITY_TERMS_BY_LANGUAGE (for logs and tests only). */
  language: string;
}

export interface OffensiveCheckOptions {
  /**
   * 'name' for legal and consent name fields, 'handle' for Riot IDs, 'text' (default) for free text.
   * Exemptions are applied per kind; see isExempt.
   */
  kind?: 'name' | 'handle' | 'text';
}

function stripMarks(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').replace(/\p{Cf}/gu, '');
}

function foldLetters(text: string): string {
  let out = '';
  for (const ch of text) out += CHAR_FOLD[ch] ?? ch;
  return out;
}

/**
 * Normalized word tokens in reading order. `chunkStart[i]` is true when token i begins a new
 * whitespace-separated chunk, so joins inside one chunk ("nigg.er", "nigg-a") can be told apart from joins
 * across a space ("a bit children", which must not join).
 */
interface Tokenized {
  tokens: string[];
  chunkStart: boolean[];
}

/** Splits text into normalized word tokens. `oneAsL` picks the "l" reading of the digit 1. */
function toTokens(text: string, oneAsL: boolean): Tokenized {
  const folded = foldLetters(stripMarks(text.toLowerCase()));
  let mapped = '';
  for (const ch of folded) {
    if (ch === '1') mapped += oneAsL ? 'l' : 'i';
    else mapped += LEET[ch] ?? ch;
  }
  const tokens: string[] = [];
  const chunkStart: boolean[] = [];
  let atChunkStart = true;
  for (const piece of mapped.split(/(\s+)/)) {
    if (piece === '') continue;
    if (/^\s+$/.test(piece)) {
      atChunkStart = true;
      continue;
    }
    for (const token of piece.split(/[^\p{L}]+/u)) {
      if (!token) continue;
      tokens.push(token);
      chunkStart.push(atChunkStart);
      atChunkStart = false;
    }
  }
  return { tokens, chunkStart };
}

function squeeze(token: string): string {
  return token.replace(/(\p{L})\1+/gu, '$1');
}

function normalizeTerm(raw: string): string {
  return toTokens(raw, false).tokens.join('');
}

/** Maps every term to its normalized form, so both sides of a match are built the same way. */
const WHOLE_TERMS = new Map<string, string>();
const SQUEEZED_TERMS = new Map<string, string>();
const SUBSTRING_TERMS = new Map<string, string>();

for (const [language, terms] of Object.entries(PROFANITY_TERMS_BY_LANGUAGE)) {
  for (const raw of terms) {
    const term = normalizeTerm(raw);
    if (!term) continue;
    if (!WHOLE_TERMS.has(term)) WHOLE_TERMS.set(term, language);
    // Short terms are never matched after squeezing: "lull" would otherwise squeeze to the Dutch "lul".
    const squeezedTerm = squeeze(term);
    if (term.length >= MIN_SQUEEZE_LENGTH && !SQUEEZED_TERMS.has(squeezedTerm)) {
      SQUEEZED_TERMS.set(squeezedTerm, term);
    }
    if (SUBSTRING_OK_TERMS.has(raw)) {
      SUBSTRING_TERMS.set(term, language);
    }
  }
}

function removeAllowedPhrases({ tokens, chunkStart }: Tokenized): Tokenized {
  const outTokens: string[] = [];
  const outStarts: boolean[] = [];
  for (let i = 0; i < tokens.length; ) {
    const phrase = ALLOWED_PHRASES.find((p) => p.every((word, offset) => tokens[i + offset] === word));
    if (phrase) {
      i += phrase.length;
    } else {
      outTokens.push(tokens[i]);
      outStarts.push(chunkStart[i]);
      i += 1;
    }
  }
  return { tokens: outTokens, chunkStart: outStarts };
}

/**
 * Candidate strings to test against the term lists:
 *  - every token;
 *  - every run of 2+ consecutive tokens inside one whitespace chunk, so "nigg.er", "nigg-a", "f-u-c-k" and
 *    "dumb-ass" join (capped at MAX_JOINED_TOKENS tokens and MAX_JOINED_LENGTH letters);
 *  - every run of 2+ consecutive 1-2 letter tokens across spaces, so "f u c k" joins but "a bit children"
 *    does not (its words are longer than two letters).
 */
function candidatesOf({ tokens, chunkStart }: Tokenized): string[] {
  const out = new Set<string>(tokens);
  for (let i = 0; i < tokens.length; i++) {
    let joined = '';
    for (let j = i; j < tokens.length && j - i < MAX_JOINED_TOKENS; j++) {
      if (j > i && chunkStart[j]) break;
      joined += tokens[j];
      if (j > i && joined.length <= MAX_JOINED_LENGTH) out.add(joined);
    }
  }
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].length > 2) continue;
    let joined = '';
    for (let j = i; j < tokens.length && j - i < MAX_JOINED_TOKENS && tokens[j].length <= 2; j++) {
      joined += tokens[j];
      if (j > i) out.add(joined);
    }
  }
  return [...out];
}

function matchCandidate(candidate: string, options: OffensiveCheckOptions): OffensiveMatch | null {
  if (candidate.length < 2 || ALLOWED_TOKENS.has(candidate)) return null;
  const kind = options.kind ?? 'text';

  const whole = WHOLE_TERMS.get(candidate);
  if (whole && !isExempt(candidate, kind)) return { term: candidate, language: whole };

  const squeezed = squeeze(candidate);
  if (squeezed !== candidate) {
    const squeezedTerm = SQUEEZED_TERMS.get(squeezed);
    if (squeezedTerm && !isExempt(squeezedTerm, kind)) {
      return { term: squeezedTerm, language: WHOLE_TERMS.get(squeezedTerm) ?? 'unknown' };
    }
  }

  if (candidate.length >= MIN_SUBSTRING_LENGTH) {
    for (const [term, language] of SUBSTRING_TERMS) {
      if (candidate.includes(term) || squeezed.includes(term)) return { term, language };
    }
  }
  return null;
}

/**
 * Returns the first offensive term found in `text`, or null. Safe for any input: non-strings and empty
 * strings return null. The caller decides what to show; do not echo `term` back to the student.
 */
export function findOffensiveTerm(
  text: string | null | undefined,
  options: OffensiveCheckOptions = {}
): OffensiveMatch | null {
  if (typeof text !== 'string' || text.length === 0) return null;
  // Digit 1 can read as "i" or "l", so check both readings when it appears.
  const readings = text.includes('1') ? [false, true] : [false];
  for (const oneAsL of readings) {
    const tokenized = removeAllowedPhrases(toTokens(text, oneAsL));
    for (const candidate of candidatesOf(tokenized)) {
      const match = matchCandidate(candidate, options);
      if (match) return match;
    }
  }
  return null;
}

/** True when `text` contains offensive language in any screened language. */
export function containsOffensiveLanguage(
  text: string | null | undefined,
  options: OffensiveCheckOptions = {}
): boolean {
  return findOffensiveTerm(text, options) !== null;
}
