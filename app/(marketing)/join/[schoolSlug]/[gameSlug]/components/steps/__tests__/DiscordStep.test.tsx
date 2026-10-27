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

  it('announces the connected state through an always-mounted status region', () => {
    const empty = renderToStaticMarkup(<DiscordStep verified={null} connecting={false} onConnect={noop} />);
    expect(empty).toContain('role="status"');
    expect(empty).toContain('aria-live="polite"');
    const connected = renderToStaticMarkup(
      <DiscordStep verified={{ username: 'coach_sam', inGuild: true }} connecting={false} onConnect={noop} />
    );
    expect(connected).toMatch(/role="status"[^>]*>.*@coach_sam/s);
  });

  it('keeps buttons focusable with aria-disabled and a 44px tap target while connecting', () => {
    const html = renderToStaticMarkup(<DiscordStep verified={null} connecting={true} onConnect={noop} />);
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain('disabled=""');
    expect(html).toContain('min-h-[44px]');
    const connected = renderToStaticMarkup(
      <DiscordStep verified={{ username: 'a', inGuild: true }} connecting={false} onConnect={noop} />
    );
    expect(connected).toMatch(/min-h-\[44px\][^>]*>Use a different Discord account/);
  });

  it('keeps the reconnect link focusable (aria-disabled, not disabled) while connecting', () => {
    const html = renderToStaticMarkup(
      <DiscordStep verified={{ username: 'a', inGuild: true }} connecting={true} onConnect={noop} />
    );
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain('disabled=""');
  });
});
