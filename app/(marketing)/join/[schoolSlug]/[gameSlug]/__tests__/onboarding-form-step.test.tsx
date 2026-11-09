// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

const { getOnboardingFormState, issueOnboardingFormLink } = vi.hoisted(() => ({
  getOnboardingFormState: vi.fn(),
  issueOnboardingFormLink: vi.fn(),
}));
vi.mock('@/app/lib/onboarding/google-form-actions', () => ({ getOnboardingFormState, issueOnboardingFormLink }));

import { OnboardingFormStep } from '../components/steps/OnboardingFormStep';
import { WizardProgressStepper } from '../components/WizardProgressStepper';

function Harness({ initial = false }: { initial?: boolean }) {
  const [done, setDone] = useState(initial);
  return <OnboardingFormStep token="t" completed={done} onCompletedChange={setDone} />;
}

const flush = () => act(async () => {});

beforeEach(() => {
  vi.useFakeTimers();
  getOnboardingFormState.mockReset().mockResolvedValue({ enabled: true, completed: false });
  issueOnboardingFormLink.mockReset().mockResolvedValue({
    ok: true,
    url: 'https://docs.google.com/forms/d/e/abc/viewform?usp=pp_url&entry.1=code',
    expiresAt: Date.now() + 6 * 3600_000,
  });
  vi.spyOn(window, 'open').mockReturnValue({ closed: false, opener: {}, location: { href: '' }, close: vi.fn() } as unknown as Window);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('OnboardingFormStep', () => {
  it('asks for a link only when the student presses Open, then shows the waiting state with a fallback link', async () => {
    render(<Harness />);
    expect(issueOnboardingFormLink).not.toHaveBeenCalled();
    expect(screen.getByText(/have not opened the form yet/i)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /open the form/i }));
    });
    expect(issueOnboardingFormLink).toHaveBeenCalledWith('t');
    expect(screen.getByText(/waiting for your submission/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open the form link/i })).toHaveAttribute('href', expect.stringContaining('entry.1=code'));
    expect(screen.getByRole('button', { name: /open the form again/i })).toBeInTheDocument();
  });

  it('polls the server and shows confirmation only once the server says completed', async () => {
    render(<Harness />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_100);
    });
    expect(getOnboardingFormState).toHaveBeenCalled();
    expect(screen.queryByText(/we received your form/i)).toBeNull();
    getOnboardingFormState.mockResolvedValue({ enabled: true, completed: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_100);
    });
    expect(screen.getByText(/we received your form/i)).toBeInTheDocument();
    const calls = getOnboardingFormState.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(getOnboardingFormState.mock.calls.length).toBe(calls); // polling stopped
  });

  it('keeps waiting through a failed poll instead of treating it as an answer', async () => {
    getOnboardingFormState.mockRejectedValueOnce(new Error('network'));
    render(<Harness />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_100);
    });
    expect(screen.queryByText(/we received your form/i)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('tells the student to reopen the link when the code in it has expired', async () => {
    issueOnboardingFormLink.mockResolvedValue({ ok: true, url: 'https://docs.google.com/x', expiresAt: Date.now() + 60_000 });
    render(<Harness />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /open the form/i }));
    });
    expect(screen.queryByText(/has expired/i)).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(95_000);
    });
    expect(screen.getByText(/verification code in that link has expired/i)).toBeInTheDocument();
    expect(screen.getByText(/open the form again/i, { selector: 'strong' })).toBeInTheDocument();
  });

  it('shows the server error when a link cannot be issued', async () => {
    issueOnboardingFormLink.mockResolvedValue({ ok: false, error: 'The onboarding form is not available right now.' });
    render(<Harness />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /open the form/i }));
    });
    await flush();
    expect(screen.getByRole('alert')).toHaveTextContent(/not available right now/i);
  });

  it('renders as done straight away when the server already recorded the completion', () => {
    render(<Harness initial />);
    expect(screen.getByText(/we received your form/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open the form/i })).toBeNull();
  });
});

describe('WizardProgressStepper', () => {
  it('shows five steps without the form and six with it', () => {
    const { rerender } = render(<WizardProgressStepper step={5} />);
    expect(screen.getByText('Step 5 of 5')).toBeInTheDocument();
    rerender(<WizardProgressStepper step={6} totalSteps={6} />);
    expect(screen.getByText('Step 6 of 6')).toBeInTheDocument();
    expect(screen.getByText('Onboarding Form')).toBeInTheDocument();
  });
});
