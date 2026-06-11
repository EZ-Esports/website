import { describe, it, expect } from 'vitest';
import { slugify, safeUrl, sanitizeDbError } from '../text-utils';

// ---------------------------------------------------------------------------
// slugify
// ---------------------------------------------------------------------------
describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Brooklyn Tech')).toBe('brooklyn-tech');
  });

  it('strips special characters', () => {
    expect(slugify('Stuyvesant H.S.')).toBe('stuyvesant-hs');
  });

  it('collapses consecutive separators', () => {
    expect(slugify('A  --  B')).toBe('a-b');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  -hello-  ')).toBe('hello');
  });

  it('falls back to a uuid-based slug for all-symbol input', () => {
    const result = slugify('!!!');
    expect(result).toMatch(/^school-[0-9a-f]{8}$/);
  });

  it('produces unique fallback slugs for repeated all-symbol calls', () => {
    const a = slugify('???');
    const b = slugify('???');
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// safeUrl
// ---------------------------------------------------------------------------
describe('safeUrl', () => {
  it('passes through http URLs', () => {
    expect(safeUrl('http://example.com')).toBe('http://example.com');
  });

  it('passes through https URLs', () => {
    expect(safeUrl('https://example.com/path?q=1')).toBe('https://example.com/path?q=1');
  });

  it('blanks out javascript: scheme', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('');
  });

  it('blanks out data: URIs', () => {
    expect(safeUrl('data:text/html,<h1>oops</h1>')).toBe('');
  });

  it('blanks out bare paths', () => {
    expect(safeUrl('/admin/delete?id=123')).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(safeUrl('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// sanitizeDbError
// ---------------------------------------------------------------------------
describe('sanitizeDbError', () => {
  it('maps unique_violation (23505) to a user-friendly message', () => {
    const err = { code: '23505', message: 'duplicate key value violates unique constraint "schools_name_key"' };
    expect(sanitizeDbError(err)).toBe('A record with this information already exists.');
  });

  it('maps foreign_key_violation (23503)', () => {
    const err = { code: '23503' };
    expect(sanitizeDbError(err)).toMatch(/linked to other data/);
  });

  it('maps not_null_violation (23502)', () => {
    const err = { code: '23502' };
    expect(sanitizeDbError(err)).toMatch(/required field/);
  });

  it('returns a generic message for unmapped errors', () => {
    expect(sanitizeDbError({ code: 'ECONNRESET' })).toMatch(/unexpected error/i);
  });

  it('handles non-object errors gracefully', () => {
    expect(sanitizeDbError('plain string error')).toMatch(/unexpected error/i);
    expect(sanitizeDbError(null)).toMatch(/unexpected error/i);
  });
});
