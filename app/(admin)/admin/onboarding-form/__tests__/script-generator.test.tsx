// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('../actions', () => ({ saveOnboardingFormSettings: vi.fn() }));

import { CopyBlock, ScriptGenerator } from '../OnboardingFormSettings';

describe('ScriptGenerator', () => {
  it('hides the script until Generate script is pressed, then shows it with a Copy button', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ScriptGenerator script="function onFormSubmit() {}" />);
    expect(screen.queryByText(/function onFormSubmit/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /generate script/i }));
    expect(screen.getByText(/function onFormSubmit/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    expect(writeText).toHaveBeenCalledWith('function onFormSubmit() {}');
  });
});

describe('CopyBlock secret', () => {
  it('keeps the key masked until Show is pressed', () => {
    render(<CopyBlock label="WEBHOOK_KEY value" value="abc123secret" secret />);
    expect(screen.queryByText('abc123secret')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /show/i }));
    expect(screen.getByText('abc123secret')).toBeInTheDocument();
  });
});
