// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

vi.mock('@/app/lib/onboarding/wizard-actions', () => ({
  submitPlayerOnboarding: vi.fn(),
  saveOnboardingDraft: vi.fn(),
}));

import { useWizardDraft } from '../hooks/useWizardDraft';
import type { InviteData } from '../types';

const invite = (role: 'player' | 'manager'): InviteData => ({
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

describe.each(['player', 'manager'] as const)('step 1 email requires an @ (%s)', (role) => {
  it('blocks an email without @ and says why', () => {
    const { result } = renderHook(() => useWizardDraft('t', invite(role), { discordUsername: null }));
    act(() => {
      result.current.setEmail('sam.school.edu');
      result.current.setGraduationYear(2027);
    });
    let ok = true;
    act(() => {
      ok = result.current.validateStep1();
    });
    expect(ok).toBe(false);
    expect(result.current.errorMessage).toMatch(/@ symbol/);
  });
});
