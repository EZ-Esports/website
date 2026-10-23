import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { ConsentStep } from '../ConsentStep';

const noop = () => {};
const baseProps = {
  tosAcknowledged: false,
  setTosAcknowledged: noop,
  participantLegalName: 'Riley Chen',
  setParticipantLegalName: noop,
  guardianFullName: '',
  setGuardianFullName: noop,
  guardianRelationship: '',
  setGuardianRelationship: noop,
  guardianEmail: '',
  setGuardianEmail: noop,
  guardianSignature: '',
  setGuardianSignature: noop,
};

describe('ConsentStep', () => {
  it('shows only the Terms of Service acknowledgment to adults', () => {
    const html = renderToStaticMarkup(<ConsentStep {...baseProps} age={19} isMinor={false} />);
    expect(html).toContain('1. Terms of Service Acknowledgment');
    expect(html).toContain('href="/terms"');
    expect(html).not.toContain('Parent or Legal Guardian Authorization');
    expect(html).not.toContain('consent-guardian-signature');
  });

  it('shows the full guardian authorization with the computed age to under-18s', () => {
    const html = renderToStaticMarkup(<ConsentStep {...baseProps} age={16} isMinor />);
    expect(html).toContain('You have entered your age as 16.');
    expect(html).toContain('2. Participant Information');
    expect(html).toContain('3. Parent or Legal Guardian Authorization');
    expect(html).toContain('4. Parent or Legal Guardian Information');
    expect(html).toContain('5. Electronic Signature');
    expect(html).toContain('consent-guardian-signature');
    // Date is shown but read-only; the server stamps the real value.
    expect(html).toMatch(/id="consent-date"[^>]*readOnly=""|readonly=""[^>]*id="consent-date"|id="consent-date"[^>]*readonly=""/i);
  });
});
