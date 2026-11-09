/**
 * Capitalizes the first letter of each word in a legal name. Words are separated by whitespace,
 * hyphens and apostrophes. Every other letter is left as typed, so "McDonald" and "DeAndre" keep
 * their casing. Surrounding whitespace is trimmed and inner runs collapse to one space.
 */
export function capitalizeNameWords(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/(^|[\s'’-])(\p{Ll})/gu, (_, before: string, letter: string) => before + letter.toUpperCase());
}
