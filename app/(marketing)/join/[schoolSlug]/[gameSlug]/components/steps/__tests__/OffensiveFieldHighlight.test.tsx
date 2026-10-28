import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { AccountInfoStep } from '../AccountInfoStep';
import { GameIdentityStep } from '../GameIdentityStep';

const noop = vi.fn();
const HINT = 'Remove offensive language from this field.';

function accountProps(invalidField: string | null) {
  return {
    legalFirstName: 'Amina',
    setLegalFirstName: noop,
    legalLastName: 'Lund',
    setLegalLastName: noop,
    email: 'amina@example.edu',
    setEmail: noop,
    graduationYear: 2027,
    setGraduationYear: noop,
    isManager: false,
    invalidField,
  };
}

/** The opening <input ...> tag whose id matches, as rendered. */
function inputTag(markup: string, id: string): string {
  const match = markup.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`));
  if (!match) throw new Error(`no input with id ${id}`);
  return match[0];
}

describe('offensive field highlight', () => {
  it('marks only the flagged name input and shows a hint under it', () => {
    const markup = renderToStaticMarkup(<AccountInfoStep {...accountProps('legalFirstName')} />);

    const first = inputTag(markup, 'account-legal-first-name');
    const last = inputTag(markup, 'account-legal-last-name');

    expect(first).toContain('aria-invalid="true"');
    expect(first).toContain('border-danger');
    expect(first).toContain('aria-describedby="legalFirstName-offensive-hint"');
    expect(markup).toContain(HINT);

    expect(last).not.toContain('aria-invalid');
    expect(last).not.toContain('border-danger');
  });

  it('shows no highlight or hint when nothing is flagged', () => {
    const markup = renderToStaticMarkup(<AccountInfoStep {...accountProps(null)} />);

    expect(markup).not.toContain(HINT);
    expect(inputTag(markup, 'account-legal-first-name')).not.toContain('aria-invalid');
  });

  it('lets the offensive highlight override the Riot ID format colour', () => {
    const markup = renderToStaticMarkup(
      <GameIdentityStep
        riotId="Demon1#NA1"
        setRiotId={noop}
        ignConfirmed={false}
        setIgnConfirmed={noop}
        isRiotIdValid
        trackerUrl={null}
        isManager={false}
        gameName="Valorant"
        invalidField="riotId"
      />
    );

    const input = markup.match(/<input[^>]*value="Demon1#NA1"[^>]*>/)?.[0] ?? '';
    expect(input).toContain('aria-invalid="true"');
    expect(input).toContain('border-danger');
    expect(input).not.toContain('emerald');
    expect(markup).toContain(HINT);
  });
});
