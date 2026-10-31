// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';

vi.mock('@/app/lib/onboarding/wizard-actions', () => ({
  submitPlayerOnboarding: vi.fn(),
  saveOnboardingDraft: vi.fn(),
}));

import { useWizardDraft } from '../hooks/useWizardDraft';
import { AccountInfoStep } from '../components/steps/AccountInfoStep';
import { BirthDateRulesStep } from '../components/steps/BirthDateRulesStep';
import type { InviteData } from '../types';

const invite = (role: 'player' | 'manager' = 'player'): InviteData => ({
  inviteId: 'i1',
  role,
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
});

function setup(role: 'player' | 'manager' = 'player', discordUsername: string | null = null) {
  return renderHook(() => useWizardDraft('t', invite(role), { discordUsername }));
}

/** Fills Step 1 so only the content screen can stop validateStep1. */
function fillStep1(result: { current: ReturnType<typeof useWizardDraft> }) {
  act(() => {
    result.current.setEmail('sam@school.edu');
    result.current.setGraduationYear(2027);
  });
}

describe('useWizardDraft content screen', () => {
  it('starts clean for ordinary names', () => {
    const { result } = setup();
    expect(result.current.contentFlags.state('legalFirstName')).toEqual({ flagged: false, overridden: false });
    fillStep1(result);
    let ok = false;
    act(() => {
      ok = result.current.validateStep1();
    });
    expect(ok).toBe(true);
  });

  it('flags a name as soon as it is typed and blocks Continue with the explanatory message', () => {
    const { result } = setup();
    fillStep1(result);
    act(() => result.current.setLegalFirstName('Fuckface'));
    expect(result.current.contentFlags.state('legalFirstName')).toEqual({ flagged: true, overridden: false });
    let ok = true;
    act(() => {
      ok = result.current.validateStep1();
    });
    expect(ok).toBe(false);
    expect(result.current.errorMessage).toMatch(/offensive language/i);
    expect(result.current.contentOverrideKeys()).toEqual([]);
  });

  it('lets the person override, which unblocks Continue and is sent to the server', () => {
    const { result } = setup();
    fillStep1(result);
    act(() => result.current.setLegalFirstName('Fuckface'));
    act(() => result.current.contentFlags.setOverride('legalFirstName', true));
    expect(result.current.contentFlags.state('legalFirstName')).toEqual({ flagged: true, overridden: true });
    let ok = false;
    act(() => {
      ok = result.current.validateStep1();
    });
    expect(ok).toBe(true);
    expect(result.current.contentOverrideKeys()).toEqual(['legalFirstName']);
  });

  it('forgets the override when the value changes, even to another flagged value', () => {
    const { result } = setup();
    act(() => result.current.setLegalFirstName('Fuckface'));
    act(() => result.current.contentFlags.setOverride('legalFirstName', true));
    act(() => result.current.setLegalFirstName('Shithead'));
    expect(result.current.contentFlags.state('legalFirstName')).toEqual({ flagged: true, overridden: false });
    expect(result.current.contentOverrideKeys()).toEqual([]);
  });

  it('drops the flag when the value is fixed, and an un-ticked box removes the override', () => {
    const { result } = setup();
    act(() => result.current.setLegalFirstName('Fuckface'));
    act(() => result.current.contentFlags.setOverride('legalFirstName', true));
    act(() => result.current.contentFlags.setOverride('legalFirstName', false));
    expect(result.current.contentOverrideKeys()).toEqual([]);
    act(() => result.current.setLegalFirstName('Alex'));
    expect(result.current.contentFlags.state('legalFirstName').flagged).toBe(false);
  });

  it('saves overrides in the draft and restores them only for the value they were given for', () => {
    const first = setup();
    act(() => first.result.current.setLegalFirstName('Fuckface'));
    act(() => first.result.current.contentFlags.setOverride('legalFirstName', true));
    const saved = first.result.current.buildCurrentPayload();
    expect(saved.contentOverrides).toEqual({ legalFirstName: 'Fuckface' });

    // Returning from Discord with the same draft: still overridden.
    const restored = renderHook(() =>
      useWizardDraft('t', { ...invite(), submissionDraft: JSON.parse(JSON.stringify(saved)) }, {})
    );
    expect(restored.result.current.contentFlags.state('legalFirstName')).toEqual({ flagged: true, overridden: true });
    expect(restored.result.current.contentOverrideKeys()).toEqual(['legalFirstName']);

    // A draft whose name changed since (or hand-edited junk) does not carry the override over.
    const stale = renderHook(() =>
      useWizardDraft(
        't',
        {
          ...invite(),
          submissionDraft: { legalFirstName: 'Shithead', contentOverrides: { legalFirstName: 'Fuckface', bogus: 'x', riotId: 5 } },
        },
        {}
      )
    );
    expect(stale.result.current.contentFlags.state('legalFirstName')).toEqual({ flagged: true, overridden: false });
    expect(stale.result.current.contentOverrideKeys()).toEqual([]);
  });

  it('restores a Discord username override after the OAuth round trip', () => {
    const draft = { contentOverrides: { discordUsername: 'xX_fuckboy_Xx' } };
    const { result } = renderHook(() =>
      useWizardDraft('t', { ...invite(), submissionDraft: draft }, { discordVerified: true, discordUsername: 'xX_fuckboy_Xx' })
    );
    expect(result.current.contentFlags.state('discordUsername')).toEqual({ flagged: true, overridden: true });
  });

  it('screens the Riot ID on step 3 and has no screened free text on step 4', () => {
    const { result } = setup();
    act(() => {
      result.current.setRiotId('ShitLord#NA1');
      result.current.setIgnConfirmed(true);
    });
    let ok = true;
    act(() => {
      ok = result.current.validateStep3();
    });
    expect(ok).toBe(false);

    act(() => {
      result.current.setBirthDate('2008-05-14');
      result.current.setCodeOfConductAccepted(true);
    });
    act(() => {
      ok = result.current.validateStep4();
    });
    expect(ok).toBe(true);
  });

  it('screens the verified Discord username on step 2', () => {
    const { result } = renderHook(() => useWizardDraft('t', invite(), { discordVerified: true, discordUsername: 'xX_fuckboy_Xx' }));
    expect(result.current.contentFlags.state('discordUsername').flagged).toBe(true);
    let ok = true;
    act(() => {
      ok = result.current.validateStep2();
    });
    expect(ok).toBe(false);
  });

  it('screens managers the same way', () => {
    const { result } = setup('manager');
    act(() => result.current.setLegalLastName('Dumbass'));
    expect(result.current.contentFlags.state('legalLastName').flagged).toBe(true);
  });

  it('does not flag names that only contain a short bad word', () => {
    const { result } = setup();
    act(() => {
      result.current.setLegalFirstName('Dickson');
      result.current.setLegalLastName('Hancock');
    });
    expect(result.current.contentFlags.state('legalFirstName').flagged).toBe(false);
    expect(result.current.contentFlags.state('legalLastName').flagged).toBe(false);
  });

  it('ignores leftover guardian text for an adult', () => {
    const { result } = setup();
    act(() => {
      result.current.setBirthDate('1990-01-01');
      result.current.setGuardianFullName('Fuck Chen');
    });
    expect(result.current.isMinor).toBe(false);
    expect(result.current.contentFlags.state('guardianFullName').flagged).toBe(false);
  });
});

describe('content warning in the form', () => {
  function Harness() {
    const draft = useWizardDraft('t', invite(), {});
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

  it('shows an inline error and an override checkbox next to the flagged field only', () => {
    render(<Harness />);
    const first = screen.getByLabelText(/legal first name/i);
    expect(screen.queryByRole('checkbox')).toBeNull();

    fireEvent.change(first, { target: { value: 'Fuckface' } });
    expect(first).toHaveAttribute('aria-invalid', 'true');
    expect(first.getAttribute('aria-describedby')).toBe('content-flag-legalFirstName');
    expect(screen.getByText(/looks like it may contain offensive language/i)).toBeInTheDocument();

    const box = screen.getByRole('checkbox', { name: /this is actually my real information/i });
    expect(box).not.toBeChecked();
    expect(screen.getByRole('link', { name: /league rules/i })).toHaveAttribute('href', '/rules');

    fireEvent.click(box);
    expect(box).toBeChecked();
    expect(first).toHaveAttribute('aria-invalid', 'false');
    expect(screen.getByText(/will be sent to EZ Esports staff for review/i)).toBeInTheDocument();

    fireEvent.change(first, { target: { value: 'Alex' } });
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(first).not.toHaveAttribute('aria-invalid');
  });
});

describe('code of conduct acknowledgement', () => {
  const props = {
    birthDate: '', setBirthDate: () => {}, codeOfConductAccepted: false, setCodeOfConductAccepted: () => {},
  };

  it('tells the person offensive information is prohibited and links the rules', () => {
    render(<BirthDateRulesStep {...props} />);
    expect(screen.getByText(/offensive or inappropriate names, usernames, Riot IDs/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /rule 3\.4/i })).toHaveAttribute('href', '/rules#submitted-information');
    expect(screen.getByText(/may change or reject any entry/i)).toBeInTheDocument();
  });
});
