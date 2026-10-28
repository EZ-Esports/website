import { describe, expect, it } from 'vitest';
import { checkProfanity, containsProfanity } from '../detect';

const flagged = (s: string) => containsProfanity(s);

describe('profanity detection: plain English', () => {
  it.each([
    'bullshit', 'fuck', 'dumbass', 'shit', 'bitch', 'asshole', 'motherfucker', 'cunt', 'faggot', 'nigger',
    'whore', 'slut', 'dickhead', 'pussy', 'wanker', 'bastard', 'cock', 'dick', 'ass', 'twat', 'retard',
    'asses', 'dumb ass', 'dumb-ass', 'Dumb_Ass', 'rapist', 'sluts', 'fucked', 'bitches', 'hitler',
  ])('flags %s', (word) => {
    expect(flagged(word)).toBe(true);
  });

  it('flags a word inside a longer handle', () => {
    expect(flagged('xXfuckboyXx')).toBe(true);
    expect(flagged('ShitLord99')).toBe(true);
    expect(flagged('Big Dick Energy')).toBe(true);
    expect(flagged('Alex fucking Chen')).toBe(true);
  });

  it('reports which term and language matched', () => {
    const r = checkProfanity('what the fuck');
    expect(r.flagged).toBe(true);
    expect(r.matches).toEqual(expect.arrayContaining([expect.objectContaining({ term: 'fuck', language: 'english' })]));
  });
});

describe('profanity detection: evasion', () => {
  it.each([
    ['FUCK', 'case'],
    ['FuCk', 'case'],
    ['f*ck', 'masking'],
    ['sh*t', 'masking'],
    ['b*tch', 'masking'],
    ['a**hole', 'masking'],
    ['fu©k', 'copyright sign'],
    ['fvck', 'v for u'],
    ['sh1t', 'leet'],
    ['5h!t', 'leet'],
    ['b1tch', 'leet'],
    ['@ss', 'leet'],
    ['a$$', 'leet'],
    ['@sshole', 'leet'],
    ['d1ckhead', 'leet'],
    ['fuuuuck', 'repeats'],
    ['shiiiit', 'repeats'],
    ['biiitch', 'repeats'],
    ['assss', 'repeats'],
    ['f.u.c.k', 'dots'],
    ['f u c k', 'spaces'],
    ['f_u_c_k', 'underscores'],
    ['s-h-i-t', 'hyphens'],
    ['fu.ck', 'dot inside'],
    ['fuck.you', 'dot between'],
    ['fűck', 'diacritic'],
    ['ｆｕｃｋ', 'fullwidth'],
    ['fu​ck', 'zero width space'],
    ['fuсk', 'cyrillic look-alike'],
  ])('flags %s (%s)', (text) => {
    expect(flagged(text)).toBe(true);
  });
});

describe('profanity detection: other languages', () => {
  it.each([
    ['mierda', 'spanish'],
    ['pendejo', 'spanish'],
    ['hijueputa', 'spanish'],
    ['puta', 'spanish'],
    ['cabrón', 'spanish'],
    ['merde', 'french'],
    ['putain', 'french'],
    ['connard', 'french'],
    ['enculé', 'french'],
    ['Scheiße', 'german'],
    ['Arschloch', 'german'],
    ['Hurensohn', 'german'],
    ['wichser', 'german'],
    ['caralho', 'portuguese'],
    ['filho da puta', 'portuguese'],
    ['buceta', 'portuguese'],
    ['cazzo', 'italian'],
    ['vaffanculo', 'italian'],
    ['stronzo', 'italian'],
    ['klootzak', 'dutch'],
    ['godverdomme', 'dutch'],
    ['kut', 'dutch'],
    ['blyat', 'russian'],
    ['cyka blyat', 'russian'],
    ['pizda', 'russian'],
    ['хуй', 'russian cyrillic'],
    ['блядь', 'russian cyrillic'],
    ['caonima', 'chinese pinyin'],
    ['cao ni ma', 'chinese pinyin'],
    ['shabi', 'chinese pinyin'],
    ['傻逼', 'chinese'],
    ['kuso', 'japanese'],
    ['bakayaro', 'japanese'],
    ['sibal', 'korean'],
    ['ssibal', 'korean'],
    ['gaesaekki', 'korean'],
    ['씨발', 'korean hangul'],
    ['sharmuta', 'arabic'],
    ['ibn sharmouta', 'arabic'],
    ['madarchod', 'hindi'],
    ['behenchod', 'hindi'],
    ['chutiya', 'hindi'],
  ])('flags %s (%s)', (text) => {
    expect(flagged(text)).toBe(true);
  });
});

describe('profanity detection: Scunthorpe problem (real names and places stay clear)', () => {
  it.each([
    'Dickson', 'Dickinson', 'Cockburn', 'Hancock', 'Hitchcock', 'Peacock', 'Assad', 'Scunthorpe', 'Essex', 'Sussex',
    'Middlesex', 'Penistone', 'Cummings', 'Cumberland', 'Classic', 'Assassin', 'Bassett', 'Cassidy', 'Massey',
    'Raccoon', 'Spicer', 'Fagan', 'Titus', 'Tito', 'Titan', 'Analyst', 'Canal', 'Annalise', 'Hannah', 'Tiit',
    'Shiitake', 'Snigger', 'Therapist', 'Grape', 'Drape', 'Sextant', 'Niger', 'Nigeria', 'Pakistan', 'Vergara',
    'Huy', 'Hui', 'Nima', 'Diao', 'Lund', 'Randi', 'Kalb', 'Wankel', 'Pissarro', 'Arsenio', 'Arsenal', 'Documentary',
    'Sasha Hu', 'Mary-Ann', 'Anna-Lisa', 'Mc Donald', "O'Brien", 'Jean-Luc Picard', 'Ng', 'Xu', 'Li', 'Wu Tang',
    'Nguyen Van Anh', 'Phuc', 'Kim Seo-yeon', 'Park Ji-hoon', 'José García', 'Zoë Müller', 'Björn Åberg', 'Łukasz',
    'Muhammad Al-Rashid', 'Priya Sharma', 'Aarav Patel', 'Ivan Petrov', 'Мария Иванова',
  ])('does not flag %s', (name) => {
    expect(flagged(name)).toBe(false);
  });

  it('does not flag plausible Riot IDs, handles and free text', () => {
    for (const text of [
      'Demon1#NA1', 'Faker#T1', 'ShadowHawk#0717', 'Jett_Main#2024', 'ProGamer717#NA1', 'Brooklyn', 'New York, NY',
      'Spanish', 'Bengali', 'Mandarin Chinese', 'Dominican Republic', 'Schedule constraints on Tuesday and a classic accommodation',
      'xX_Sniper_Xx#1234', 'Ash Itchy', 'Pass the ball',
    ]) {
      expect(flagged(text), text).toBe(false);
    }
  });

  it('does not treat digits alone as letters', () => {
    expect(flagged('717')).toBe(false);
    expect(flagged('55')).toBe(false);
    expect(flagged('#7177')).toBe(false);
  });

  it('keeps a doubled letter doubled so ordinary words do not match', () => {
    expect(flagged('as')).toBe(false);
    expect(flagged('Asa')).toBe(false);
    expect(flagged('assess')).toBe(false);
  });
});

describe('profanity detection: input edge cases', () => {
  it('handles empty, whitespace and nullish input', () => {
    expect(checkProfanity('')).toEqual({ flagged: false, matches: [] });
    expect(checkProfanity('   ')).toEqual({ flagged: false, matches: [] });
    expect(checkProfanity(null).flagged).toBe(false);
    expect(checkProfanity(undefined).flagged).toBe(false);
  });

  it('is stable when called repeatedly (no shared regex state)', () => {
    for (let i = 0; i < 5; i++) {
      expect(flagged('fuck')).toBe(true);
      expect(flagged('Dickson')).toBe(false);
    }
  });
});
