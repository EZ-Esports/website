import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RulesPage, { metadata } from '../page';
import { FOOTER_LINKS, ROUTES } from '@/app/lib/constants';
import sitemap from '@/app/sitemap';

describe('League Rules Page (/rules)', () => {
  it('exports valid metadata for SEO and social sharing', () => {
    expect(metadata.title).toBe('League Rulebook & Code of Conduct | EZ Esports');
    expect(metadata.description).toContain('Official EZ Esports League Handbook & Code of Conduct');
  });

  it('renders the Hero with the correct title', () => {
    const html = renderToStaticMarkup(RulesPage());
    expect(html).toContain('League Rulebook &amp; Code of Conduct');
  });

  describe('Key Sections Rendering', () => {
    const html = renderToStaticMarkup(RulesPage());

    it('renders Section 1: Player & Roster Eligibility', () => {
      expect(html).toContain('1. Player &amp; Roster Eligibility');
      expect(html).toContain('High School Enrollment');
      expect(html).toContain('Varsity vs. Junior Varsity (JV) Placement');
      expect(html).toContain('Multi-School Teams');
      expect(html).toContain('Student Age &amp; Standing Limits');
      expect(html).toContain('Dual-Roster Restriction');
    });

    it('renders Section 2: Competitive Integrity & Anti-Cheating', () => {
      expect(html).toContain('2. Competitive Integrity &amp; Anti-Cheating');
      expect(html).toContain('Zero Tolerance for Third-Party Software');
      expect(html).toContain('Smurfing, Account Sharing &amp; Ringers');
      expect(html).toContain('Bug &amp; Glitch Exploits');
      expect(html).toContain('Replay Preservation');
    });

    it('renders Section 3: Sportsmanship & Scholastic Conduct', () => {
      expect(html).toContain('3. Sportsmanship &amp; Scholastic Conduct');
      expect(html).toContain('Respectful Communication');
      expect(html).toContain('Prohibition of Toxic Behavior, Harassment &amp; Hate Speech');
      expect(html).toContain('Representation of Schools');
      expect(html).toContain('Zero Tolerance for Hate Speech');
    });

    it('renders Section 4: Match Operations & Scheduling', () => {
      expect(html).toContain('4. Match Operations &amp; Scheduling');
      expect(html).toContain('Check-In Windows');
      expect(html).toContain('15-Minute Grace Period');
      expect(html).toContain('Forfeit Criteria');
      expect(html).toContain('Rescheduling Protocol');
      expect(html).toContain('Match Reporting &amp; Scoreboard Verification');
    });

    it('renders Section 5: Disciplinary Actions & Formal Appeals', () => {
      expect(html).toContain('5. Disciplinary Actions &amp; Formal Appeals');
      expect(html).toContain('Tiered Penalty Structure');
      expect(html).toContain('Tier 1: Formal Warning');
      expect(html).toContain('Tier 2: Match Forfeiture');
      expect(html).toContain('Tier 3: Multi-Week or Season Disqualification');
      expect(html).toContain('Tier 4: Indefinite League Ban');
      expect(html).toContain('Grievance &amp; Dispute Submission');
      expect(html).toContain('Formal Appeals Workflow');
    });

    it('renders navigation anchors and table of contents', () => {
      expect(html).toContain('href="#eligibility"');
      expect(html).toContain('href="#integrity"');
      expect(html).toContain('href="#sportsmanship"');
      expect(html).toContain('href="#operations"');
      expect(html).toContain('href="#disciplinary"');
    });
  });

  describe('Integration with Navigation & Constants', () => {
    it('includes League Rules in FOOTER_LINKS', () => {
      const rulesFooterLink = FOOTER_LINKS.find((link) => link.href === '/rules');
      expect(rulesFooterLink).toBeDefined();
      expect(rulesFooterLink?.label).toBe('League Rules');
    });

    it('defines rules route in ROUTES constant', () => {
      expect(ROUTES.rules).toBe('/rules');
    });

    it('includes /rules in sitemap entries', () => {
      const entries = sitemap();
      const rulesEntry = entries.find((entry) => entry.url.endsWith('/rules'));
      expect(rulesEntry).toBeDefined();
      expect(rulesEntry?.changeFrequency).toBe('monthly');
    });

    it('ensures ApplyForm checkbox label links directly to /rules with target="_blank"', () => {
      const applyFormSource = readFileSync(
        resolve(process.cwd(), 'app/(marketing)/apply/ApplyForm.tsx'),
        'utf8'
      );
      expect(applyFormSource).toContain('<Link');
      expect(applyFormSource).toContain('href="/rules"');
      expect(applyFormSource).toContain('target="_blank"');
      expect(applyFormSource).toContain('league rules');
    });
  });
});
