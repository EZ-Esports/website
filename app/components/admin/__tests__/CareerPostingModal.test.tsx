import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CareerPostingModal, { postingToFormValues } from '../CareerPostingModal';
import type { AdminCareerPostingWithStats } from '@/app/types/careers';

vi.mock('@/app/(admin)/admin/careers/actions', () => ({
  createCareerPostingAction: vi.fn(),
  updateCareerPostingAction: vi.fn(),
}));

const posting: AdminCareerPostingWithStats = {
  id: 'posting-1',
  title: 'Lead Caster',
  slug: 'lead-caster',
  department: 'Productions & Broadcast',
  location: 'Hybrid (Brooklyn)',
  commitment: '3 hours / week',
  employmentType: 'Paid Contractor',
  summary: 'Call the big matches.',
  description: '### Overview\nCast live.',
  status: 'closed',
  displayOrder: 7,
  createdAt: new Date(),
  updatedAt: new Date(),
  applicantCount: 2,
  pendingCount: 0,
};

const noop = () => {};
const render = (p: AdminCareerPostingWithStats | null) =>
  renderToStaticMarkup(<CareerPostingModal isOpen posting={p} onClose={noop} onSuccess={noop} />);

describe('postingToFormValues', () => {
  it('carries every editable field from the posting', () => {
    expect(postingToFormValues(posting)).toEqual({
      title: 'Lead Caster',
      slug: 'lead-caster',
      department: 'Productions & Broadcast',
      location: 'Hybrid (Brooklyn)',
      commitment: '3 hours / week',
      employmentType: 'Paid Contractor',
      summary: 'Call the big matches.',
      description: '### Overview\nCast live.',
      status: 'closed',
      displayOrder: 7,
    });
  });

  it('keeps a displayOrder of 0', () => {
    expect(postingToFormValues({ ...posting, displayOrder: 0 }).displayOrder).toBe(0);
  });

  it('falls back to blank defaults for a new opening', () => {
    const v = postingToFormValues(null);
    expect(v.title).toBe('');
    expect(v.slug).toBe('');
    expect(v.summary).toBe('');
    expect(v.description).toBe('');
    expect(v.status).toBe('published');
    expect(v.displayOrder).toBe(0);
    expect(v.department).toBe('Software Engineering');
  });
});

describe('CareerPostingModal', () => {
  it('renders nothing while closed', () => {
    expect(
      renderToStaticMarkup(<CareerPostingModal isOpen={false} posting={posting} onClose={noop} onSuccess={noop} />),
    ).toBe('');
  });

  it('pre-fills the form from the posting being edited', () => {
    const html = render(posting);
    expect(html).toContain('Edit career opening');
    expect(html).toContain('value="Lead Caster"');
    expect(html).toContain('value="lead-caster"');
    expect(html).toContain('value="Productions &amp; Broadcast"');
    expect(html).toContain('value="Hybrid (Brooklyn)"');
    expect(html).toContain('value="3 hours / week"');
    expect(html).toContain('value="Paid Contractor"');
    expect(html).toContain('value="7"');
    expect(html).toContain('Call the big matches.');
    expect(html).toContain('Cast live.');
    expect(html).toMatch(/<option value="closed" selected=""/);
  });

  it('opens blank defaults for a new opening', () => {
    const html = render(null);
    expect(html).toContain('New career opening');
    expect(html).toContain('value="Remote (NYC High School League)"');
    expect(html).toMatch(/<option value="published" selected=""/);
    expect(html).not.toContain('Lead Caster');
  });

  it('keys the mounted form per posting so state cannot carry over', () => {
    const props = { isOpen: true, onClose: noop, onSuccess: noop };
    const a = CareerPostingModal({ ...props, posting }) as React.ReactElement;
    const b = CareerPostingModal({ ...props, posting: { ...posting, id: 'posting-2' } }) as React.ReactElement;
    const fresh = CareerPostingModal({ ...props, posting: null }) as React.ReactElement;
    expect(a.key).toBe('posting-1');
    expect(b.key).toBe('posting-2');
    expect(fresh.key).toBe('new');
  });
});
