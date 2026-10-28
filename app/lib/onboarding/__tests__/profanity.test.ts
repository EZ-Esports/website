import { describe, it, expect } from 'vitest';
import {
  PROFANITY_TERMS_BY_LANGUAGE,
  containsOffensiveLanguage,
  findOffensiveTerm,
} from '../profanity';

const NAME = { kind: 'name' } as const;

describe('profanity: positives per language', () => {
  const samples: Array<[string, string]> = [
    ['english', 'bullshit'],
    ['english', 'fuck'],
    ['english', 'dumbass'],
    ['english', 'nigger'],
    ['spanish', 'puta'],
    ['spanish', 'cabrón'],
    ['french', 'merde'],
    ['french', 'connard'],
    ['german', 'Scheiße'],
    ['german', 'Arschloch'],
    ['portuguese', 'caralho'],
    ['italian', 'cazzo'],
    ['dutch', 'godverdomme'],
    ['russian', 'блядь'],
    ['russian', 'хуй'],
    ['polish', 'kurwa'],
    ['turkish', 'orospu'],
    ['hindi_urdu', 'madarchod'],
  ];

  for (const [language, word] of samples) {
    it(`flags a ${language} term`, () => {
      const match = findOffensiveTerm(word);
      expect(match).not.toBeNull();
      expect(match?.language).toBe(language);
    });
  }

  it('flags a sentence that contains a term among ordinary words', () => {
    expect(containsOffensiveLanguage('this is total bullshit honestly')).toBe(true);
  });
});

describe('profanity: normalization', () => {
  it('is case-insensitive', () => {
    expect(containsOffensiveLanguage('FUCK')).toBe(true);
    expect(containsOffensiveLanguage('FuCk')).toBe(true);
  });

  it('strips diacritics', () => {
    expect(containsOffensiveLanguage('Connárd')).toBe(true);
    expect(containsOffensiveLanguage('pútá')).toBe(true);
    expect(containsOffensiveLanguage('mérdá')).toBe(true);
    expect(containsOffensiveLanguage('Scheiße')).toBe(true);
  });

  it('maps leetspeak digits and symbols to letters', () => {
    expect(containsOffensiveLanguage('@ssh0le')).toBe(true);
    expect(containsOffensiveLanguage('sh1t')).toBe(true);
    expect(containsOffensiveLanguage('$hit')).toBe(true);
    expect(containsOffensiveLanguage('dumba$$')).toBe(true);
    expect(containsOffensiveLanguage('@$$')).toBe(true);
    expect(containsOffensiveLanguage('b1tch')).toBe(true);
  });

  it('reads the digit 1 as both i and l', () => {
    // "lu1" only matches the Dutch term "lul" under the l reading; "sh1t" needs the i reading.
    expect(containsOffensiveLanguage('lu1')).toBe(true);
    expect(containsOffensiveLanguage('sh1t')).toBe(true);
  });

  it('treats separators between letters as breaks', () => {
    expect(containsOffensiveLanguage('f.u.c.k')).toBe(true);
    expect(containsOffensiveLanguage('f-u-c-k')).toBe(true);
    expect(containsOffensiveLanguage('f u c k')).toBe(true);
    expect(containsOffensiveLanguage('f_u_c_k')).toBe(true);
    expect(containsOffensiveLanguage('fu-ck')).toBe(true);
  });

  it('collapses repeated letters', () => {
    expect(containsOffensiveLanguage('fuuuck')).toBe(true);
    expect(containsOffensiveLanguage('bitchhhh')).toBe(true);
    expect(containsOffensiveLanguage('assholeeee')).toBe(true);
  });

  it('ignores zero-width characters inside a word', () => {
    expect(containsOffensiveLanguage('fu​ck')).toBe(true);
  });

  it('catches a mixed-script spelling with a Latin lookalike', () => {
    // Latin x and Cyrillic у, й: folds to the same form as the Cyrillic term.
    expect(containsOffensiveLanguage('xуй')).toBe(true);
  });

  it('finds a term inside a longer compound', () => {
    expect(containsOffensiveLanguage('dumbasses')).toBe(true);
    expect(containsOffensiveLanguage('motherfuckers')).toBe(true);
    expect(containsOffensiveLanguage('Arschlochs')).toBe(true);
  });
});

describe('profanity: whole-word matching avoids substring false positives', () => {
  it('does not flag short terms inside longer words', () => {
    for (const word of ['class', 'classroom', 'assess', 'assistant', 'glass', 'grass', 'bass', 'pass', 'massage', 'passage']) {
      expect(containsOffensiveLanguage(word), word).toBe(false);
    }
  });

  it('does not flag a term hidden inside a surname or place name', () => {
    for (const word of ['Hancock', 'Cockburn', 'Cockerell', 'Scunthorpe', 'Penistone', 'Essex', 'Therapist', 'Titanic']) {
      expect(containsOffensiveLanguage(word), word).toBe(false);
    }
  });

  it('does not flag ordinary words that match a foreign term by accident', () => {
    // "pedal" is a Polish slur but an everyday English word; "huren" is Dutch for "to rent".
    expect(containsOffensiveLanguage('pedal')).toBe(false);
    expect(containsOffensiveLanguage('huren')).toBe(false);
  });

  it('does not flag an ordinary word that contains a substring term', () => {
    expect(containsOffensiveLanguage('mishit')).toBe(false);
    expect(containsOffensiveLanguage('shiitake')).toBe(false);
    expect(containsOffensiveLanguage('niggardly')).toBe(false);
  });
});

describe('profanity: allowlist and phrase exceptions', () => {
  it('lets the honours phrase "cum laude" through, but still flags "cum" on its own', () => {
    expect(containsOffensiveLanguage('Graduated cum laude')).toBe(false);
    expect(containsOffensiveLanguage('magna cum laude')).toBe(false);
    expect(containsOffensiveLanguage('cum')).toBe(true);
  });

  it('lets "spic and span" through', () => {
    expect(containsOffensiveLanguage('spic and span')).toBe(false);
    expect(containsOffensiveLanguage('spic')).toBe(true);
  });
});

describe('profanity: legal names that must pass', () => {
  const realNames = [
    'Dickson', 'Dickinson', 'Dickens', 'Hancock', 'Cockburn', 'Cockerell', 'Scunthorpe',
    'Assess', 'Class', 'Glass', 'Bassey', 'Massey', 'Passmore', 'Mitchell', 'Hughes',
    'Kowalczyk', 'Nguyen', 'Öztürk', 'Ozturk', 'Lull', 'Cunningham', 'Cumming', 'Pussycat',
    'Shiitake', 'Therapist', 'Titan', 'Essex', 'Alexander', 'Chen', 'Demir', 'Brooks',
    // Country names that share letters with a slur once repeated letters collapse.
    'Niger', 'Chad', 'Cuba', 'Mongolia', 'Tuscany',
  ];

  for (const name of realNames) {
    it(`accepts the name "${name}"`, () => {
      expect(containsOffensiveLanguage(name, NAME)).toBe(false);
      expect(containsOffensiveLanguage(name)).toBe(false);
    });
  }

  it('accepts real given or surnames that collide with a whole-word term, in name fields only', () => {
    expect(containsOffensiveLanguage('Dick', NAME)).toBe(false);
    expect(containsOffensiveLanguage('Dyke', NAME)).toBe(false);
    expect(containsOffensiveLanguage('Coon', NAME)).toBe(false);
  });

  it('still flags those same words in free text and Riot IDs', () => {
    expect(containsOffensiveLanguage('Dick')).toBe(true);
    expect(containsOffensiveLanguage('Dick#NA1')).toBe(true);
  });

  it('still flags slurs and profanity in a name field', () => {
    expect(containsOffensiveLanguage('Fuck', NAME)).toBe(true);
    expect(containsOffensiveLanguage('Nigger', NAME)).toBe(true);
    expect(containsOffensiveLanguage('Bullshit', NAME)).toBe(true);
    expect(containsOffensiveLanguage('Cunt', NAME)).toBe(true);
  });
});

describe('profanity: Riot ID and clean free text', () => {
  it('accepts ordinary Riot IDs and tags', () => {
    for (const id of ['Demon1#LFT1', 'Faker#T1', 'Sass#NA1', 'Tyler#NA1', 'Hancock#EUW']) {
      expect(containsOffensiveLanguage(id), id).toBe(false);
    }
  });

  it('flags an offensive Riot ID', () => {
    expect(containsOffensiveLanguage('dumbass#NA1')).toBe(true);
    expect(containsOffensiveLanguage('Sh1tlord#NA1')).toBe(true);
  });

  it('accepts ordinary feedback text', () => {
    expect(containsOffensiveLanguage('I can only play on Tuesdays after class, and my ping is about 40ms.')).toBe(false);
    expect(containsOffensiveLanguage('Please keep my schedule in mind for the spring season.')).toBe(false);
  });

  it('flags offensive feedback text', () => {
    expect(containsOffensiveLanguage('This league is bullshit and the staff are dumbasses.')).toBe(true);
  });
});

describe('profanity: return value and input handling', () => {
  it('returns the matched language and term', () => {
    expect(findOffensiveTerm('merde')).toEqual({ term: 'merde', language: 'french' });
  });

  it('returns null for empty, missing and non-string input', () => {
    expect(findOffensiveTerm('')).toBeNull();
    expect(findOffensiveTerm(undefined)).toBeNull();
    expect(findOffensiveTerm(null)).toBeNull();
    expect(containsOffensiveLanguage(undefined)).toBe(false);
    expect(containsOffensiveLanguage(42 as unknown as string)).toBe(false);
  });

  it('handles very long input without error', () => {
    const long = 'a'.repeat(50_000) + ' hello world ' + 'f u c k '.repeat(200);
    expect(containsOffensiveLanguage(long)).toBe(true);
    expect(containsOffensiveLanguage('a'.repeat(50_000))).toBe(false);
  });
});

describe('profanity: real given names and surnames that were once false positives', () => {
  const realNames = [
    'Amina', 'Randi', 'Lund', 'Kut', 'Hoer', 'Cipa', 'Suka', 'Pust', 'Lul', 'Puta', 'Bosta', 'Gandu',
    'Ibne', 'Kahpe', 'Tering', 'Troia', 'Hancock', 'Mary-Kate', 'Jean-Luc', 'Anna-Lisa', 'Hancock-Smith',
  ];

  for (const name of realNames) {
    it(`accepts "${name}" in a legal name field`, () => {
      expect(containsOffensiveLanguage(name, { kind: 'name' })).toBe(false);
    });
    it(`accepts "${name}" as a Riot ID`, () => {
      expect(containsOffensiveLanguage(`${name}#NA1`, { kind: 'handle' })).toBe(false);
    });
  }

  it('accepts Amina, Randi and Lund everywhere, including free text', () => {
    for (const name of ['Amina', 'Randi', 'Lund']) {
      expect(containsOffensiveLanguage(name), name).toBe(false);
    }
  });

  it('still flags the ambiguous short foreign words in free text', () => {
    for (const word of ['kut', 'hoer', 'puta', 'suka', 'lul', 'kahpe']) {
      expect(containsOffensiveLanguage(`that was a ${word} call`), word).toBe(true);
    }
  });

  it('still flags English slurs in name and Riot ID fields', () => {
    expect(containsOffensiveLanguage('Fuck', { kind: 'name' })).toBe(true);
    expect(containsOffensiveLanguage('Nigger#NA1', { kind: 'handle' })).toBe(true);
    expect(containsOffensiveLanguage('Dick#NA1', { kind: 'handle' })).toBe(true);
  });
});

describe('profanity: spelling bypasses', () => {
  it('catches fuk, fck, fvck, phuck, fuq and bytch', () => {
    for (const word of ['fuk', 'fck', 'fvck', 'phuck', 'fuq', 'bytch', 'FUK', 'Phuck']) {
      expect(containsOffensiveLanguage(word), word).toBe(true);
    }
  });

  it('catches the n-word split by a dot or hyphen', () => {
    expect(containsOffensiveLanguage('nigg.er')).toBe(true);
    expect(containsOffensiveLanguage('nigg-a')).toBe(true);
    expect(containsOffensiveLanguage('nigg-er', { kind: 'name' })).toBe(true);
    expect(containsOffensiveLanguage('nigg.a#NA1', { kind: 'handle' })).toBe(true);
  });

  it('catches other dot or hyphen splits', () => {
    expect(containsOffensiveLanguage('f-uck')).toBe(true);
    expect(containsOffensiveLanguage('dumb-ass')).toBe(true);
    expect(containsOffensiveLanguage('b.i.t.ch')).toBe(true);
  });

  it('does not join words across a space just because they are short', () => {
    expect(containsOffensiveLanguage('a bit children are noisy')).toBe(false);
    expect(containsOffensiveLanguage('nigg ger')).toBe(false);
  });

  it('keeps hyphenated and dotted names passing', () => {
    expect(containsOffensiveLanguage('Mary-Kate', { kind: 'name' })).toBe(false);
    expect(containsOffensiveLanguage('Anna.Lisa', { kind: 'name' })).toBe(false);
    expect(containsOffensiveLanguage('Dickson-Lee', { kind: 'name' })).toBe(false);
  });
});

describe('profanity: term list integrity', () => {
  it('keeps every term as a single lowercase letter token with no empty entries', () => {
    for (const [language, terms] of Object.entries(PROFANITY_TERMS_BY_LANGUAGE)) {
      for (const term of terms) {
        expect(term.trim(), `${language}: "${term}"`).toBe(term);
        expect(term, `${language}: "${term}"`).not.toMatch(/\s/);
        expect(term.length, `${language}: "${term}"`).toBeGreaterThan(1);
      }
    }
  });

  it('has at least one term in each language group', () => {
    for (const [language, terms] of Object.entries(PROFANITY_TERMS_BY_LANGUAGE)) {
      expect(terms.length, language).toBeGreaterThan(0);
    }
  });
});
