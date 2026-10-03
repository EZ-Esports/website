import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminSegmented, AdminTab, AdminTabList, AdminTabPanel, AdminTabs } from '../AdminTabs';

vi.mock('@/app/(admin)/admin/leadership/actions', () => ({
  createLeader: vi.fn(),
  updateLeader: vi.fn(),
  deleteLeader: vi.fn(),
}));

import LeadershipManagerClient from '../LeadershipManagerClient';

/** The opening tag of the element whose text content is `label`. */
function openingTagFor(html: string, tag: string, label: string): string {
  const match = html.match(new RegExp(`<${tag}[^>]*>(?:(?!</${tag}>)[\\s\\S])*?${label}`));
  if (!match) throw new Error(`No <${tag}> containing ${label}`);
  return match[0].slice(0, match[0].indexOf('>') + 1);
}

describe('AdminSegmented', () => {
  const options = [
    { value: 'varsity', label: 'Varsity' },
    { value: 'jv', label: 'JV' },
  ];

  it('marks only the selected option as selected and checked', () => {
    const html = renderToStaticMarkup(
      <AdminSegmented aria-label="Division" value="jv" onChange={() => {}} options={options} />,
    );

    expect(html).toContain('role="radiogroup"');
    expect(openingTagFor(html, 'label', 'JV')).toContain('data-selected="true"');
    expect(openingTagFor(html, 'label', 'Varsity')).not.toContain('data-selected');
    expect(html).toMatch(/<input[^>]*checked=""[^>]*value="jv"/);
    expect(html).not.toMatch(/<input[^>]*checked=""[^>]*value="varsity"/);
  });

  it('stays outside the add-officer form, so its generated radio name is never submitted', () => {
    const html = renderToStaticMarkup(<LeadershipManagerClient initialLeadership={[]} peopleList={[]} />);
    const forms = html.match(/<form[\s\S]*?<\/form>/g) ?? [];

    expect(html).toContain('role="radiogroup"');
    expect(forms.length).toBeGreaterThan(0);
    for (const form of forms) {
      expect(form).not.toContain('type="radio"');
      expect(form).not.toContain('role="radiogroup"');
    }
  });
});

describe('AdminTabs', () => {
  it('selects the controlled tab and mounts only its panel', () => {
    const html = renderToStaticMarkup(
      <AdminTabs selectedKey="roles" onSelectionChange={() => {}}>
        <AdminTabList aria-label="Sections">
          <AdminTab id="staff">Staff members</AdminTab>
          <AdminTab id="roles">Roles manager</AdminTab>
        </AdminTabList>
        <AdminTabPanel id="staff">Staff panel body</AdminTabPanel>
        <AdminTabPanel id="roles">Roles panel body</AdminTabPanel>
      </AdminTabs>,
    );

    const tabs = html.match(/<div[^>]*role="tab"[^>]*>[\s\S]*?<\/div>/g) ?? [];
    const tabFor = (label: string) => tabs.find((t) => t.includes(label)) ?? '';

    expect(tabs).toHaveLength(2);
    expect(tabFor('Roles manager')).toContain('aria-selected="true"');
    expect(tabFor('Staff members')).toContain('aria-selected="false"');
    expect(html).toContain('Roles panel body');
    expect(html).not.toContain('Staff panel body');
  });
});
