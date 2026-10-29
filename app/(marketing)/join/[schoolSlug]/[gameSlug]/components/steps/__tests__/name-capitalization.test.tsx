// @vitest-environment jsdom
import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';

vi.mock('@/app/lib/onboarding/wizard-actions', () => ({
  submitPlayerOnboarding: vi.fn(),
  saveOnboardingDraft: vi.fn(),
}));

import { useWizardDraft } from '../../../hooks/useWizardDraft';
import { AccountInfoStep } from '../AccountInfoStep';
import { ConsentStep } from '../ConsentStep';
import type { InviteData } from '../../../types';

const invite: InviteData = {
  inviteId: 'i1',
  role: 'player',
  intendedFirstName: 'Sam',
  intendedLastName: 'Miller',
  schoolId: 's1',
  schoolName: 'Stuyvesant',
  schoolSlug: 'stuyvesant',
  gameId: null,
  gameName: 'Valorant',
  gameSlug: 'valorant',
  submissionDraft: null,
  expiresAt: new Date(),
};

function AccountHarness() {
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  return (
    <AccountInfoStep
      legalFirstName={first}
      setLegalFirstName={setFirst}
      legalLastName={last}
      setLegalLastName={setLast}
      email=""
      setEmail={() => {}}
      graduationYear={0}
      setGraduationYear={() => {}}
      isManager={false}
    />
  );
}

function DraftAccountHarness() {
  const draft = useWizardDraft('t', invite, {});
  return (
    <AccountInfoStep
      legalFirstName={draft.legalFirstName}
      setLegalFirstName={draft.setLegalFirstName}
      legalLastName={draft.legalLastName}
      setLegalLastName={draft.setLegalLastName}
      email={draft.email}
      setEmail={draft.setEmail}
      graduationYear={draft.graduationYear}
      setGraduationYear={draft.setGraduationYear}
      isManager={false}
      contentFlags={draft.contentFlags}
    />
  );
}

describe('legal name capitalization on Step 1', () => {
  it('leaves the text alone while typing and capitalizes each word on blur', () => {
    render(<AccountHarness />);
    const first = screen.getByLabelText(/legal first name/i) as HTMLInputElement;
    const last = screen.getByLabelText(/legal last name/i) as HTMLInputElement;

    fireEvent.change(first, { target: { value: 'sam' } });
    expect(first.value).toBe('sam');

    fireEvent.change(last, { target: { value: 'miller-jones' } });
    fireEvent.blur(first);
    fireEvent.blur(last);
    expect(first.value).toBe('Sam');
    expect(last.value).toBe('Miller-Jones');
  });

  it('keeps mixed-case names as typed on blur', () => {
    render(<AccountHarness />);
    const last = screen.getByLabelText(/legal last name/i) as HTMLInputElement;
    fireEvent.change(last, { target: { value: "o'neil" } });
    fireEvent.blur(last);
    expect(last.value).toBe("O'Neil");

    fireEvent.change(last, { target: { value: 'McDonald' } });
    fireEvent.blur(last);
    expect(last.value).toBe('McDonald');
  });

  it('keeps the offensive-content flag and override working after the blur capitalizes the value', () => {
    render(<DraftAccountHarness />);
    const first = screen.getByLabelText(/legal first name/i) as HTMLInputElement;

    fireEvent.change(first, { target: { value: 'fuckface' } });
    fireEvent.blur(first);
    expect(first.value).toBe('Fuckface');
    expect(first).toHaveAttribute('aria-invalid', 'true');

    const box = screen.getByRole('checkbox', { name: /this is actually my real information/i });
    fireEvent.click(box);
    expect(box).toBeChecked();
    expect(first).toHaveAttribute('aria-invalid', 'false');
  });
});

describe('participant legal name capitalization on the consent step', () => {
  function ConsentHarness() {
    const [participant, setParticipant] = useState('riley chen');
    return (
      <ConsentStep
        age={16}
        isMinor
        tosAcknowledged={false}
        setTosAcknowledged={() => {}}
        participantLegalName={participant}
        setParticipantLegalName={setParticipant}
        guardianFullName=""
        setGuardianFullName={() => {}}
        guardianRelationship=""
        setGuardianRelationship={() => {}}
        guardianEmail=""
        setGuardianEmail={() => {}}
        guardianSignature=""
        setGuardianSignature={() => {}}
      />
    );
  }

  it('capitalizes the prefilled participant name on blur', () => {
    render(<ConsentHarness />);
    const input = document.getElementById('consent-participant-name') as HTMLInputElement;
    expect(input.value).toBe('riley chen');
    fireEvent.blur(input);
    expect(input.value).toBe('Riley Chen');
  });
});

describe('participant legal name at submission', () => {
  it('normalizes a name that was never blurred before the consent is built', () => {
    const { result } = renderHook(() => useWizardDraft('t', invite, {}));
    act(() => {
      result.current.setParticipantLegalName('riley chen');
    });
    expect(result.current.buildConsent().participantLegalName).toBe('Riley Chen');
  });
});
