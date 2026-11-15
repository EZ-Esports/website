import { describe, it, expect } from 'vitest';
import { capitalizeNameWords } from '../name-case';

describe('capitalizeNameWords', () => {
  it('capitalizes two lowercase words', () => {
    expect(capitalizeNameWords('sam gabe')).toBe('Sam Gabe');
  });

  it('leaves an already capitalized name unchanged', () => {
    expect(capitalizeNameWords('Sam Gabe')).toBe('Sam Gabe');
  });

  it('capitalizes an all-lowercase single word', () => {
    expect(capitalizeNameWords('alex')).toBe('Alex');
  });

  it('capitalizes after a hyphen', () => {
    expect(capitalizeNameWords('miller-jones')).toBe('Miller-Jones');
  });

  it('capitalizes after an apostrophe', () => {
    expect(capitalizeNameWords("o'neil")).toBe("O'Neil");
  });

  it('keeps mixed-case letters inside a word as typed', () => {
    expect(capitalizeNameWords('mcdonald')).toBe('Mcdonald');
    expect(capitalizeNameWords('McDonald')).toBe('McDonald');
    expect(capitalizeNameWords('deandre')).toBe('Deandre');
    expect(capitalizeNameWords('DeAndre')).toBe('DeAndre');
  });

  it('trims surrounding whitespace and collapses inner runs', () => {
    expect(capitalizeNameWords('  sam   gabe  ')).toBe('Sam Gabe');
  });

  it('returns an empty string for an empty or blank entry', () => {
    expect(capitalizeNameWords('')).toBe('');
    expect(capitalizeNameWords('   ')).toBe('');
  });

  it('capitalizes a single letter', () => {
    expect(capitalizeNameWords('a')).toBe('A');
  });

  it('capitalizes accented first letters', () => {
    expect(capitalizeNameWords('élodie')).toBe('Élodie');
  });

  it('does not touch characters that are not lowercase letters', () => {
    expect(capitalizeNameWords('2pac')).toBe('2pac');
    expect(capitalizeNameWords('-x')).toBe('-X');
  });
});
