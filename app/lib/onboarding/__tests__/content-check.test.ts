import { describe, it, expect } from 'vitest';
import {
  CONTENT_FIELDS,
  collectContentValues,
  evaluateContent,
  findFlaggedFields,
  findTooLongFields,
  parseSavedOverrides,
  stepForContentFields,
} from '../content-check';
import { stepForRejection } from '@/app/(marketing)/join/[schoolSlug]/[gameSlug]/types';

describe('findFlaggedFields', () => {
  it('flags only the offending fields and ignores blanks and non-strings', () => {
    const flagged = findFlaggedFields({
      legalFirstName: 'Alex',
      legalLastName: 'Fucker',
      riotId: '  ',
      countryOfBirth: undefined,
      feedback: 'no complaints',
    });
    expect(flagged.map((f) => f.field)).toEqual(['legalLastName']);
    expect(flagged[0]).toMatchObject({ label: 'legal last name', value: 'Fucker' });
    expect(flagged[0].matches[0]).toMatchObject({ term: 'fuck', language: 'english' });
  });

  it('keeps fields in a stable order regardless of input order', () => {
    const flagged = findFlaggedFields({ feedback: 'shit', legalFirstName: 'bitch' });
    expect(flagged.map((f) => f.field)).toEqual(['legalFirstName', 'feedback']);
  });
});

describe('length limits', () => {
  it('flags values over a field limit and does not scan more than the limit', () => {
    const huge = 'a'.repeat(100_000);
    expect(findTooLongFields({ legalFirstName: huge, riotId: 'ok#NA1' })).toEqual(['legalFirstName']);
    expect(findTooLongFields({ feedback: 'x'.repeat(1000) })).toEqual([]);
    const start = performance.now();
    findFlaggedFields({ legalFirstName: huge, feedback: 's$'.repeat(50_000), riotId: 'f '.repeat(50_000) });
    expect(performance.now() - start).toBeLessThan(1000);
  });

  it('parses saved overrides defensively', () => {
    expect(parseSavedOverrides({ riotId: 'x', bogus: 'y', feedback: 7, legalFirstName: 'a'.repeat(500) })).toEqual({ riotId: 'x' });
    expect(parseSavedOverrides(null)).toEqual({});
    expect(parseSavedOverrides(['riotId'])).toEqual({});
  });
});

describe('collectContentValues', () => {
  it('reads every screened field, including the Discord username', () => {
    const values = collectContentValues(
      {
        legalFirstName: 'A',
        legalLastName: 'B',
        riotId: 'C#NA1',
        countryOfBirth: 'D',
        primaryLanguageAtHome: 'E',
        surveyDetails: { feedback: 'F' },
        consent: { participantLegalName: 'Other Name', guardianFullName: 'G', guardianRelationship: 'H', guardianSignature: 'I' },
      },
      'disc'
    );
    expect(Object.keys(values).sort()).toEqual(Object.keys(CONTENT_FIELDS).sort());
    expect(values.discordUsername).toBe('disc');
  });

  it('skips a participant name that is just the first and last name again', () => {
    const values = collectContentValues({
      legalFirstName: 'Alex',
      legalLastName: 'Chen',
      consent: { participantLegalName: ' alex chen ' },
    });
    expect(values.participantLegalName).toBeUndefined();
  });
});

describe('evaluateContent', () => {
  const values = { legalFirstName: 'Fuckface', riotId: 'ShitLord#NA1' };

  it('blocks every flagged field without an override', () => {
    const r = evaluateContent(values, undefined);
    expect(r.blocked.map((f) => f.field)).toEqual(['legalFirstName', 'riotId']);
    expect(r.overridden).toEqual([]);
  });

  it('splits flagged fields into overridden and blocked', () => {
    const r = evaluateContent(values, ['riotId']);
    expect(r.overridden.map((f) => f.field)).toEqual(['riotId']);
    expect(r.blocked.map((f) => f.field)).toEqual(['legalFirstName']);
  });

  it('ignores overrides for fields that are not flagged and for unknown keys', () => {
    const r = evaluateContent({ legalFirstName: 'Alex' }, ['legalFirstName', 'riotId', '__proto__', 42, null]);
    expect(r).toEqual({ overridden: [], blocked: [] });
  });

  it('treats a malformed overrides value as no overrides', () => {
    expect(evaluateContent(values, 'riotId' as unknown as string[]).blocked).toHaveLength(2);
    expect(evaluateContent(values, null).blocked).toHaveLength(2);
  });
});

describe('step mapping', () => {
  it('opens the earliest step holding a flagged field', () => {
    expect(stepForContentFields(['feedback', 'legalFirstName'])).toBe(1);
    expect(stepForContentFields(['riotId'])).toBe(3);
    expect(stepForContentFields(['guardianSignature'])).toBe(5);
    expect(stepForContentFields(['discordUsername'])).toBe(2);
    expect(stepForContentFields([])).toBe(1);
  });

  it('sends a content_flagged rejection to that step and leaves the other codes alone', () => {
    expect(stepForRejection('content_flagged', ['countryOfBirth'])).toBe(4);
    expect(stepForRejection('field_too_long', ['feedback'])).toBe(4);
    expect(stepForRejection('manager_password_required')).toBe(1);
    expect(stepForRejection('discord_required')).toBe(2);
  });
});
