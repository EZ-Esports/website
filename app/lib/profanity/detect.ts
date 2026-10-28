import { INNOCENT_WORDS, TERM_LISTS } from './terms';

/**
 * Profanity and slur detection for short user-supplied text (names, handles, Riot IDs).
 *
 * Two goals pull against each other: catching evasion (case, leetspeak, f*ck, f.u.c.k, fuuuck,
 * look-alike letters, accents) and not flagging real names (the Scunthorpe problem). The balance is:
 *
 * - Evasion is handled by compiling every term into a regular expression, not by rewriting the
 *   text. Each letter accepts its look-alikes (`s` -> s 5 $), long terms accept repeated letters,
 *   and interior letters may be masked with `*`. The text is only case-folded, accent-stripped and
 *   separator-normalized, so digits and symbols keep their meaning as word boundaries.
 * - Short or ambiguous terms ("ass", "cock", "dick") match only as whole words. Long unambiguous
 *   terms ("fuck", "shit") match anywhere, so "xXfuckboyXx" is caught, and a short list of innocent
 *   words that contain them ("shiitake", "snigger") is blanked out first.
 *
 * A match is never proof of bad intent (someone really is named Dick), which is why the onboarding
 * flow lets a person override a flag and records that they did. This module only answers "does this
 * look offensive"; it decides nothing.
 */

export interface ProfanityMatch {
  /** The list entry that matched, as written in the term list. */
  term: string;
  language: string;
}

export interface ProfanityResult {
  flagged: boolean;
  matches: ProfanityMatch[];
}

/** Characters a letter may be disguised as. Letters not listed match only themselves. */
const LOOKALIKES: Record<string, string> = {
  a: 'a4@',
  c: 'c©¢',
  e: 'e3€',
  i: 'i1!|',
  l: 'l1|',
  o: 'o0',
  s: 's5$',
  t: 't7+',
  u: 'uv',
};

/** Symbols that stay inside a word instead of acting as separators, because they stand in for letters. */
const WORD_SYMBOLS = '@$!*|+©¢€';
const KEEP = `\\p{L}\\p{N}${WORD_SYMBOLS.replace(/[$|+*]/g, '\\$&')}`;

const INVISIBLE = /[­​-‏‪-‮⁠﻿]/g;

/** Letters with no Unicode decomposition that still have an obvious ASCII reading. */
const FOLD: Record<string, string> = { ß: 'ss', æ: 'ae', œ: 'oe', ø: 'o', đ: 'd', ł: 'l', ı: 'i', þ: 'th', ð: 'd' };

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', і: 'i', ї: 'yi', є: 'ye', ґ: 'g',
};

/** Cyrillic letters that look like Latin ones, used when a word mixes both scripts ("fuсk" with a Cyrillic с). */
const CYRILLIC_LOOKALIKE: Record<string, string> = {
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', х: 'x', у: 'y', і: 'i', ѕ: 's', ј: 'j', к: 'k', м: 'm', т: 't', н: 'h',
};

function foldAccents(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{Mn}/gu, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[ßæœøđłıþð]/g, (c) => FOLD[c] ?? c);
}

function mapScript(chunk: string): string {
  if (!/\p{Script=Cyrillic}/u.test(chunk)) return chunk;
  const hasLatin = /[a-z]/.test(chunk);
  const table = hasLatin ? CYRILLIC_LOOKALIKE : CYRILLIC_TO_LATIN;
  return chunk.replace(/\p{Script=Cyrillic}/gu, (c) => table[c] ?? c);
}

// A run of three or more single characters split by separators ("f u c k", "f.u.c.k", "s_h_i_t") is one word.
const UNIT = `[a-z0-9${WORD_SYMBOLS.replace(/[$|+*]/g, '\\$&')}]`;
const SPLIT_LETTERS = new RegExp(
  `(?<!${UNIT})${UNIT}(?:[\\s._\\-]+${UNIT}(?!${UNIT})){2,}`,
  'gu'
);

interface PreparedText {
  /** Words separated by single spaces. */
  spaced: string;
  /** Separators removed inside each space-delimited chunk ("fu.ck" -> "fuck"); chunks stay apart. */
  squashed: string;
}

export function prepareText(raw: string): PreparedText {
  const folded = foldAccents(raw.replace(INVISIBLE, ''))
    .split(/(\s+)/)
    .map(mapScript)
    .join('');
  const joined = folded.replace(SPLIT_LETTERS, (m) => m.replace(/[\s._\-]+/g, ''));
  const strip = new RegExp(`[^${KEEP}]+`, 'gu');
  const spaced = joined.replace(strip, ' ').trim();
  const squashed = joined
    .split(/\s+/)
    .map((chunk) => chunk.replace(strip, ''))
    .filter(Boolean)
    .join(' ');
  return { spaced, squashed };
}

interface CompiledTerm {
  term: string;
  language: string;
  kind: 'contains' | 'word';
  regex: RegExp;
}

function classFor(ch: string, interior: boolean): string {
  const base = LOOKALIKES[ch] ?? ch;
  const escaped = base.replace(/[\\\]^\-$|+*.]/g, '\\$&');
  return `[${escaped}${interior ? '\\*' : ''}]`;
}

/**
 * One word of a term as a pattern. Repeated letters are accepted ("fuuuck"), but a term of three
 * letters or fewer repeats only its last letter, so "Tiit" is not "tit". A doubled letter in the
 * term ("ass") must stay doubled, which is what keeps "as" and "Asa" clear.
 */
function wordPattern(word: string): string {
  const runs: { ch: string; n: number }[] = [];
  for (const ch of word) {
    const last = runs[runs.length - 1];
    if (last && last.ch === ch) last.n += 1;
    else runs.push({ ch, n: 1 });
  }
  const limited = [...word].length <= 3;
  return runs
    .map(({ ch, n }, i) => {
      const interior = i > 0 && i < runs.length - 1;
      const cls = classFor(ch, interior);
      const flexible = !limited || i === runs.length - 1;
      if (flexible) return n >= 2 ? `${cls}{${n},}` : `${cls}+`;
      return n >= 2 ? `${cls}{${n}}` : cls;
    })
    .join('');
}

function compile(): CompiledTerm[] {
  const seen = new Set<string>();
  const out: CompiledTerm[] = [];
  for (const [language, list] of Object.entries(TERM_LISTS)) {
    for (const kind of ['contains', 'word'] as const) {
      for (const term of list[kind] ?? []) {
        const folded = foldAccents(term).trim();
        const key = `${kind}|${folded}`;
        if (!folded || seen.has(key)) continue;
        seen.add(key);
        const body = folded.split(/\s+/).map(wordPattern).join('\\s+');
        const source =
          kind === 'word' ? `(?<!\\p{L})${body}(?:e?[s5$])?(?!\\p{L})` : body;
        out.push({ term, language, kind, regex: new RegExp(source, 'gu') });
      }
    }
  }
  return out;
}

const COMPILED = compile();

const INNOCENT = new RegExp(INNOCENT_WORDS.map((w) => foldAccents(w)).join('|'), 'gu');

const NATIVE_TERMS: { term: string; language: string }[] = Object.entries(TERM_LISTS).flatMap(([language, list]) =>
  (list.native ?? []).map((term) => ({ term: term.normalize('NFC').toLowerCase(), language }))
);

/** A real hit is made mostly of letters; "717" is not "tit" just because 7 and 1 can stand in for letters. */
function looksLikeText(matched: string): boolean {
  const letters = matched.match(/\p{L}/gu)?.length ?? 0;
  return letters >= 1 && letters * 3 >= matched.length;
}

export function checkProfanity(text: string | null | undefined): ProfanityResult {
  if (!text || !text.trim()) return { flagged: false, matches: [] };

  const prepared = prepareText(text);
  const spaced = prepared.spaced.replace(INNOCENT, ' ');
  const squashed = prepared.squashed.replace(INNOCENT, ' ');

  const matches: ProfanityMatch[] = [];
  const seen = new Set<string>();
  const add = (term: string, language: string) => {
    const key = `${language}|${term}`;
    if (seen.has(key)) return;
    seen.add(key);
    matches.push({ term, language });
  };

  for (const c of COMPILED) {
    const views = c.kind === 'word' ? [spaced] : [spaced, squashed];
    for (const view of views) {
      if (!view) continue;
      let hit = false;
      for (const m of view.matchAll(c.regex)) {
        if (looksLikeText(m[0])) {
          hit = true;
          break;
        }
      }
      if (hit) {
        add(c.term, c.language);
        break;
      }
    }
  }

  const nativeText = text.normalize('NFC').toLowerCase();
  for (const n of NATIVE_TERMS) {
    if (nativeText.includes(n.term)) add(n.term, n.language);
  }

  return { flagged: matches.length > 0, matches };
}

export function containsProfanity(text: string | null | undefined): boolean {
  return checkProfanity(text).flagged;
}
