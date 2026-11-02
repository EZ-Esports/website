import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  CONSENT_FORM_VERSION,
  CONSENT_TEXT,
  TERMS_OF_SERVICE_PATH,
  calculateAge,
  formatConsentIntro,
  isMinorAge,
  isPlausibleBirthDate,
  isStudentAgeInRange,
  MAX_STUDENT_AGE,
  MIN_STUDENT_AGE,
  validateConsent,
} from '../consent';

const guardian = {
  tosAcknowledged: true,
  participantLegalName: 'Riley Chen',
  guardianFullName: 'Morgan Chen',
  guardianRelationship: 'Mother',
  guardianEmail: 'morgan@example.com',
  guardianSignature: 'MC',
};

describe('consent form text', () => {
  it('is pinned to its version: changing the legal wording requires bumping CONSENT_FORM_VERSION', () => {
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(CONSENT_TEXT))
      .digest('hex');
    // If this fails, you changed legal text. Bump CONSENT_FORM_VERSION and update both values together.
    expect({ version: CONSENT_FORM_VERSION, hash }).toEqual({
      version: '2026-10-v1',
      hash: '9fa9dd76751185b039c8ebeff7eda67071b49baac8b0b816a83bf2097e2e0350',
    });
  });

  it('interpolates the age into the guardian intro', () => {
    expect(formatConsentIntro(16)).toBe(
      'You have entered your age as 16. Because you are under the age of 18, a parent or legal guardian must review and authorize your participation in EZ Esports.'
    );
  });

  it('links to the in-site Terms of Service page', () => {
    expect(TERMS_OF_SERVICE_PATH).toBe('/terms');
  });
});

describe('calculateAge', () => {
  const now = new Date('2026-10-23T16:00:00Z');

  it('counts whole years and respects the birthday', () => {
    expect(calculateAge(new Date('2008-10-23'), now)).toBe(18);
    expect(calculateAge(new Date('2008-10-24'), now)).toBe(17);
    expect(calculateAge(new Date('2010-01-01'), now)).toBe(16);
  });

  it('uses the New York calendar date around midnight UTC', () => {
    // 2026-10-24 02:00 UTC is still 2026-10-23 in New York.
    expect(calculateAge(new Date('2008-10-24'), new Date('2026-10-24T02:00:00Z'))).toBe(17);
  });

  it('treats 18 as an adult', () => {
    expect(isMinorAge(17)).toBe(true);
    expect(isMinorAge(18)).toBe(false);
  });
});

describe('isPlausibleBirthDate', () => {
  const now = new Date('2026-10-23T16:00:00Z');

  it('accepts ordinary dates of birth', () => {
    expect(isPlausibleBirthDate(new Date('2010-05-01'), now)).toBe(true);
  });

  it('rejects 5-6 digit years, pre-1900 dates, future dates and invalid dates', () => {
    expect(isPlausibleBirthDate(new Date('+275760-01-01'), now)).toBe(false);
    expect(isPlausibleBirthDate(new Date('+020100-05-01'), now)).toBe(false);
    expect(isPlausibleBirthDate(new Date('1899-12-31'), now)).toBe(false);
    expect(isPlausibleBirthDate(new Date('2030-01-01'), now)).toBe(false);
    expect(isPlausibleBirthDate(new Date('not a date'), now)).toBe(false);
  });
});

describe('validateConsent', () => {
  const adult = { age: 25, fallbackParticipantName: 'Sam Lee' };
  const minor = { age: 16, fallbackParticipantName: 'Riley Chen' };

  it('requires the Terms of Service acknowledgment for everyone', () => {
    expect(() => validateConsent(undefined, adult)).toThrow('Terms of Service');
    expect(() => validateConsent({ tosAcknowledged: false }, adult)).toThrow('Terms of Service');
    expect(() => validateConsent({ tosAcknowledged: 'true' as any }, adult)).toThrow('Terms of Service');
    expect(() => validateConsent({ ...guardian, tosAcknowledged: false }, minor)).toThrow('Terms of Service');
  });

  it('accepts an adult with only the acknowledgment and ignores stray guardian fields', () => {
    const result = validateConsent({ ...guardian }, adult);
    expect(result).toMatchObject({
      isMinor: false,
      ageAtSigning: 25,
      participantLegalName: 'Riley Chen',
      guardianFullName: null,
      guardianEmail: null,
      guardianSignature: null,
    });
  });

  it('falls back to the legal name for adults who did not retype it', () => {
    expect(validateConsent({ tosAcknowledged: true }, adult).participantLegalName).toBe('Sam Lee');
  });

  it.each([
    ['participantLegalName', "participant's full legal name"],
    ['guardianFullName', 'full legal name'],
    ['guardianRelationship', 'relationship'],
    ['guardianEmail', 'email'],
    ['guardianSignature', 'electronic signature'],
  ])('requires %s for a minor', (field, message) => {
    expect(() => validateConsent({ ...guardian, [field]: '   ' }, minor)).toThrow(
      new RegExp(message, 'i')
    );
  });

  it('rejects a one-character signature and a malformed guardian email', () => {
    expect(() => validateConsent({ ...guardian, guardianSignature: 'M' }, minor)).toThrow('signature');
    expect(() => validateConsent({ ...guardian, guardianEmail: 'morgan@' }, minor)).toThrow('email');
  });

  it('normalizes a valid minor consent', () => {
    expect(
      validateConsent({ ...guardian, guardianEmail: ' Morgan@Example.com ', guardianFullName: ' Morgan Chen ' }, minor)
    ).toEqual({
      formVersion: CONSENT_FORM_VERSION,
      isMinor: true,
      ageAtSigning: 16,
      tosAcknowledged: true,
      participantLegalName: 'Riley Chen',
      guardianFullName: 'Morgan Chen',
      guardianRelationship: 'Mother',
      guardianEmail: 'morgan@example.com',
      guardianSignature: 'MC',
    });
  });

  it('does not echo submitted values in error messages', () => {
    try {
      validateConsent({ ...guardian, guardianEmail: 'secret-guardian' }, minor);
    } catch (err: any) {
      expect(err.message).not.toContain('secret-guardian');
    }
  });
});

describe('student age range (13 to 21 inclusive)', () => {
  const now = new Date('2026-10-23T16:00:00Z');
  const accepted = (dob: string) => isStudentAgeInRange(calculateAge(new Date(dob), now));

  it('pins the range', () => {
    expect([MIN_STUDENT_AGE, MAX_STUDENT_AGE]).toEqual([13, 21]);
  });

  it('rejects 12 and accepts 13, including the day before and of the 13th birthday', () => {
    expect(accepted('2014-06-01')).toBe(false); // 12
    expect(accepted('2013-10-24')).toBe(false); // turns 13 tomorrow
    expect(accepted('2013-10-23')).toBe(true); // turns 13 today
    expect(accepted('2013-01-01')).toBe(true); // 13
  });

  it('accepts 21 and rejects 22, including the day before and of the 22nd birthday', () => {
    expect(accepted('2005-10-23')).toBe(true); // 21
    expect(accepted('2004-10-24')).toBe(true); // turns 22 tomorrow
    expect(accepted('2004-10-23')).toBe(false); // turns 22 today
    expect(accepted('2000-01-01')).toBe(false); // 26
  });

  it('uses the New York calendar date for the birthday edge', () => {
    const lateUtc = new Date('2026-10-24T02:00:00Z'); // still 23 Oct in New York
    expect(isStudentAgeInRange(calculateAge(new Date('2013-10-24'), lateUtc))).toBe(false);
    expect(isStudentAgeInRange(calculateAge(new Date('2004-10-24'), lateUtc))).toBe(true);
  });

  it('keeps 13-17 in the guardian flow', () => {
    expect(isMinorAge(MIN_STUDENT_AGE)).toBe(true);
    expect(isMinorAge(17)).toBe(true);
    expect(isMinorAge(18)).toBe(false);
  });
});
