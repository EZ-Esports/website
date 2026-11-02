import { describe, expect, it } from 'vitest';
import {
  SCHOOL_EMAIL_DOMAIN_MESSAGE,
  SCHOOL_EMAIL_REQUIRED_MESSAGE,
  SCHOOL_EMAIL_SAME_MESSAGE,
  checkSchoolEmail,
  isSchoolEmail,
  normalizeEmail,
} from '../school-email';

describe('school email rules (spec-056)', () => {
  it('accepts a well-formed nycstudents.net address, trimmed and case-insensitive', () => {
    expect(isSchoolEmail('achen@nycstudents.net')).toBe(true);
    expect(isSchoolEmail('  AChen@NYCStudents.NET  ')).toBe(true);
    expect(checkSchoolEmail(' AChen@NYCStudents.NET ', 'achen@gmail.com')).toBeNull();
  });

  it('normalizes to trimmed lower case and tolerates non-strings', () => {
    expect(normalizeEmail('  A@B.C ')).toBe('a@b.c');
    expect(normalizeEmail(undefined)).toBe('');
    expect(normalizeEmail(42)).toBe('');
  });

  it.each([
    'x@nycstudents.net.evil.com',
    'x@nycstudents.net@evil.com',
    'x@evil.com@nycstudents.net',
    'x@evilnycstudents.net',
    'x@mail.nycstudents.net',
    'x@nycstudents.network',
    'x@nycstudents.net.',
    'x@nycstudents.net/',
    'x @nycstudents.net',
    'x@nycstudents.net x',
    'x@nycstudents,net',
    '@nycstudents.net',
    'nycstudents.net',
    'x@NYCSTUDENTS.NET\n@evil.com',
    'x@schools.nyc.gov',
    '',
  ])('rejects %j', (value) => {
    expect(isSchoolEmail(value)).toBe(false);
    expect(checkSchoolEmail(value, 'personal@gmail.com')).not.toBeNull();
  });

  it('returns a specific message for each failure', () => {
    expect(checkSchoolEmail('', 'p@gmail.com')).toBe(SCHOOL_EMAIL_REQUIRED_MESSAGE);
    expect(checkSchoolEmail('x@gmail.com', 'p@gmail.com')).toBe(SCHOOL_EMAIL_DOMAIN_MESSAGE);
    expect(checkSchoolEmail('no-at-sign', 'p@gmail.com')).toMatch(/@ symbol/);
  });

  it('requires the school email to differ from the personal email, ignoring case and spaces', () => {
    expect(checkSchoolEmail('achen@nycstudents.net', ' ACHEN@nycstudents.net ')).toBe(SCHOOL_EMAIL_SAME_MESSAGE);
  });
});
