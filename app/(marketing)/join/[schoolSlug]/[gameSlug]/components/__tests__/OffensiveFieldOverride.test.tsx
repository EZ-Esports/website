import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import {
  OffensiveFieldHint,
  OffensiveFieldOverrideProvider,
  type OffensiveFieldOverrideState,
} from '../OffensiveField';

const CHECKBOX_TEXT = 'This is my real information, and I confirm it is not offensive.';

function withOverrides(state: Partial<OffensiveFieldOverrideState>) {
  return {
    flagged: [],
    isConfirmed: () => false,
    setConfirmed: vi.fn(),
    ...state,
  } as OffensiveFieldOverrideState;
}

describe('OffensiveFieldHint confirmation checkbox', () => {
  it('appears under a flagged field and not under a clean one', () => {
    const markup = renderToStaticMarkup(
      <OffensiveFieldOverrideProvider value={withOverrides({ flagged: ['legalFirstName'] })}>
        <OffensiveFieldHint invalidField={null} field="legalFirstName" />
        <OffensiveFieldHint invalidField={null} field="legalLastName" />
      </OffensiveFieldOverrideProvider>
    );

    expect(markup.split(CHECKBOX_TEXT).length - 1).toBe(1);
    expect(markup).toContain('id="legalFirstName-override"');
    expect(markup).not.toContain('id="legalLastName-override"');
  });

  it('shows no checkbox and no message for a clean field with nothing flagged', () => {
    const markup = renderToStaticMarkup(
      <OffensiveFieldOverrideProvider value={withOverrides({ flagged: [] })}>
        <OffensiveFieldHint invalidField={null} field="legalFirstName" />
      </OffensiveFieldOverrideProvider>
    );
    expect(markup).toBe('');
  });

  it('shows no checkbox outside the provider, so steps rendered on their own are unchanged', () => {
    const markup = renderToStaticMarkup(<OffensiveFieldHint invalidField={null} field="legalFirstName" />);
    expect(markup).toBe('');
  });

  it('reflects a confirmed field as checked', () => {
    const markup = renderToStaticMarkup(
      <OffensiveFieldOverrideProvider
        value={withOverrides({ flagged: ['riotId'], isConfirmed: (f) => f === 'riotId' })}
      >
        <OffensiveFieldHint invalidField={null} field="riotId" />
      </OffensiveFieldOverrideProvider>
    );
    expect(markup).toMatch(/<input[^>]*id="riotId-override"[^>]*checked=""/);
  });

  it('keeps the server highlight message alongside the checkbox when the field is also flagged', () => {
    const markup = renderToStaticMarkup(
      <OffensiveFieldOverrideProvider value={withOverrides({ flagged: ['feedback'] })}>
        <OffensiveFieldHint invalidField="feedback" field="feedback" />
      </OffensiveFieldOverrideProvider>
    );
    expect(markup).toContain('Remove offensive language from this field.');
    expect(markup).toContain(CHECKBOX_TEXT);
  });
});
