import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AdminSidebarNav from '../AdminSidebarNav';
import { filterAdminNav } from '@/app/lib/admin-nav';
import { ADMIN_SECTION_PERMISSIONS } from '@/app/lib/staff-access';

const everything = filterAdminNav(['/admin', ...Object.keys(ADMIN_SECTION_PERMISSIONS)]);

function triggerFor(html: string, label: string): string {
  const escaped = label.replace('&', '&amp;');
  const buttons = html.match(/<button[^>]*>[\s\S]*?<\/button>/g) ?? [];
  const match = buttons.find((button) => button.includes(escaped));
  if (!match) throw new Error(`No disclosure trigger for ${label}`);
  return match;
}

describe('AdminSidebarNav', () => {
  it('expands only the category containing the active route on first render', () => {
    const html = renderToStaticMarkup(<AdminSidebarNav pathname="/admin/news/new" categories={everything} />);

    expect(triggerFor(html, 'Website Content')).toContain('aria-expanded="true"');
    expect(triggerFor(html, 'Website Content')).toContain('contains the current page');
    expect(triggerFor(html, 'People & Staffing')).toContain('aria-expanded="false"');
    expect(triggerFor(html, 'League Operations')).toContain('aria-expanded="false"');
    expect(html).toMatch(/<a[^>]*href="\/admin\/news"[^>]*aria-current="page"|<a[^>]*aria-current="page"[^>]*href="\/admin\/news"/);
  });

  it('wires each trigger to its panel with aria-controls', () => {
    const html = renderToStaticMarkup(<AdminSidebarNav pathname="/admin" categories={everything} />);
    const trigger = triggerFor(html, 'League Operations');
    const controls = trigger.match(/aria-controls="([^"]+)"/)?.[1];

    expect(controls).toBeTruthy();
    expect(html).toContain(`id="${controls}"`);
  });

  it('keeps every category collapsed and marks Overview current on /admin', () => {
    const html = renderToStaticMarkup(<AdminSidebarNav pathname="/admin" categories={everything} />);

    expect(html).not.toContain('aria-expanded="true"');
    expect(html).toMatch(/<a[^>]*href="\/admin"[^>]*aria-current="page"|<a[^>]*aria-current="page"[^>]*href="\/admin"/);
  });

  it('renders only the categories it is given', () => {
    const newsOnly = filterAdminNav(['/admin', '/admin/news']);
    const html = renderToStaticMarkup(<AdminSidebarNav pathname="/admin" categories={newsOnly} />);

    expect(html).toContain('Website Content');
    expect(html).not.toContain('People &amp; Staffing');
    expect(html).not.toContain('League Operations');
    expect(html).not.toContain('href="/admin/gallery"');
  });
});
