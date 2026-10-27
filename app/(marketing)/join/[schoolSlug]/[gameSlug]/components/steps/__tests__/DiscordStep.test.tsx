import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { DiscordStep } from '../DiscordStep';

const noop = () => {};

describe('DiscordStep', () => {
  it('offers only Connect Discord, with no typed handle or honor-system checkbox', () => {
    const html = renderToStaticMarkup(<DiscordStep verified={null} connecting={false} onConnect={noop} />);
    expect(html).toContain('Connect Discord');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('I confirm that I have joined');
  });

  it('shows the verified username once connected', () => {
    const html = renderToStaticMarkup(
      <DiscordStep verified={{ username: 'coach_sam', inGuild: true }} connecting={false} onConnect={noop} />
    );
    expect(html).toContain('@coach_sam');
    expect(html).toContain('Use a different Discord account');
  });
});
