import Link from 'next/link';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import Tile from '@/app/components/ui/Tile';

describe('Tile Component', () => {
  it('applies scoped data-tile-link hover and focus classes when href is provided with default tone', () => {
    const html = renderToStaticMarkup(
      <Tile title="Season standings" href="/valorant/standings">
        <p>Tile Content</p>
      </Tile>
    );

    // Article container has the scoped selector
    expect(html).toContain('has-[[data-tile-link]:hover]:border-foreground-muted');
    expect(html).toContain('has-[[data-tile-link]:focus-visible]:border-foreground-muted');
    // Article does NOT have the old unscoped any-anchor hover selector
    expect(html).not.toContain('has-[a:hover]');
    expect(html).not.toContain('has-[a:focus-visible]');

    // Header link carries data-tile-link attribute
    expect(html).toMatch(/<a[^>]*data-tile-link[^>]*href="\/valorant\/standings"/);
  });

  it('does not attach data-tile-link to inner child links', () => {
    const html = renderToStaticMarkup(
      <Tile title="Season standings" href="/valorant/standings">
        <div>
          <Link href="/valorant/teams/brooklyn-tech">Brooklyn Tech</Link>
          <Link href="/valorant/teams/stuyvesant">Stuyvesant</Link>
        </div>
      </Tile>
    );

    // Header link has data-tile-link
    expect(html).toMatch(/<a[^>]*data-tile-link[^>]*href="\/valorant\/standings"/);

    // Child links do not have data-tile-link
    expect(html).toMatch(/<a href="\/valorant\/teams\/brooklyn-tech">Brooklyn Tech<\/a>/);
    expect(html).not.toMatch(/<a[^>]*data-tile-link[^>]*href="\/valorant\/teams\/brooklyn-tech"/);
    expect(html).not.toMatch(/<a[^>]*data-tile-link[^>]*href="\/valorant\/teams\/stuyvesant"/);
  });

  it('omits hover highlight selector when href is not provided', () => {
    const html = renderToStaticMarkup(
      <Tile title="Information Only">
        <p>Static info</p>
      </Tile>
    );

    expect(html).not.toContain('has-[[data-tile-link]:hover]');
    expect(html).not.toContain('data-tile-link');
  });

  it('omits hover highlight selector when tone is accent or feature', () => {
    const accentHtml = renderToStaticMarkup(
      <Tile title="Accent Tile" href="/valorant/schedule" tone="accent">
        <p>Accent content</p>
      </Tile>
    );
    expect(accentHtml).not.toContain('has-[[data-tile-link]:hover]');

    const featureHtml = renderToStaticMarkup(
      <Tile title="Feature Tile" href="/valorant/schedule" tone="feature">
        <p>Feature content</p>
      </Tile>
    );
    expect(featureHtml).not.toContain('has-[[data-tile-link]:hover]');
  });
});
