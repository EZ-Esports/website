import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import TermsPage, { metadata } from '../page';
import { FOOTER_LINKS, ROUTES } from '@/app/lib/constants';
import sitemap from '@/app/sitemap';

describe('Terms of Service Page (/terms)', () => {
  it('exports valid metadata for SEO and social sharing', () => {
    expect(metadata.title).toBe('Terms of Service | EZ Esports');
    expect(metadata.description).toContain('terms that govern participation in EZ Esports programs');
  });

  it('renders the Hero with the correct title', () => {
    const html = renderToStaticMarkup(TermsPage());
    expect(html).toContain('Terms of Service');
  });

  describe('Key Sections Rendering', () => {
    const html = renderToStaticMarkup(TermsPage());

    it('renders Section 1: Acceptance & Eligibility covering students, advisors, and coaches', () => {
      expect(html).toContain('1. Acceptance &amp; Eligibility');
      expect(html).toContain('Student participants');
      expect(html).toContain('Advisors, coaches, and staff');
      expect(html).toContain('Consent for minors');
    });

    it('renders Section 2: Acceptable Use & Conduct', () => {
      expect(html).toContain('2. Acceptable Use &amp; Conduct');
      expect(html).toContain('Harassment and hate');
      expect(html).toContain('Cheating');
      expect(html).toContain('Roster and identity fraud');
      expect(html).toContain('Match manipulation');
    });

    it('renders Section 3: In-Person / LAN Tournament Waiver & Event Disclaimers', () => {
      expect(html).toContain('3. In-Person / LAN Tournament Waiver &amp; Event Disclaimers');
      expect(html).toContain('Assumption of risk');
      expect(html).toContain('Release of liability');
      expect(html).toContain('Medical and emergency treatment');
      expect(html).toContain('Media and photo release');
    });

    it('renders Section 4: Limitation of Liability & "As Is" Warranty', () => {
      expect(html).toContain('4. Limitation of Liability &amp; &quot;As Is&quot; Warranty');
      expect(html).toContain('as is');
      expect(html).toContain('disclaim all warranties');
      expect(html).toContain('liability for any claim');
    });

    it('renders Section 5: Intellectual Property & Submissions', () => {
      expect(html).toContain('5. Intellectual Property &amp; Submissions');
      expect(html).toContain('Your content and feedback');
    });

    it('renders Section 6: Governing Law & Dispute Resolution', () => {
      expect(html).toContain('6. Governing Law &amp; Dispute Resolution');
      expect(html).toContain('State of New York');
      expect(html).toContain('Binding arbitration');
    });

    it('renders Section 7 and 8: Changes and Contact', () => {
      expect(html).toContain('7. Changes to These Terms');
      expect(html).toContain('8. Contact Us');
      expect(html).toContain('info@ezesports.org');
    });

    it('renders cross-links to Privacy Policy and League Rules', () => {
      expect(html).toContain('href="/privacy"');
      expect(html).toContain('href="/rules"');
    });
  });

  describe('Integration with Navigation & Constants', () => {
    it('defines terms route in ROUTES constant', () => {
      expect(ROUTES.terms).toBe('/terms');
    });

    it('includes Terms of Service in FOOTER_LINKS linking to /terms', () => {
      const termsFooterLink = FOOTER_LINKS.find((link) => link.href === '/terms');
      expect(termsFooterLink).toBeDefined();
      expect(termsFooterLink?.label).toBe('Terms of Service');
    });

    it('includes /terms in sitemap entries with yearly frequency', () => {
      const entries = sitemap();
      const termsEntry = entries.find((entry) => entry.url.endsWith('/terms'));
      expect(termsEntry).toBeDefined();
      expect(termsEntry?.changeFrequency).toBe('yearly');
      expect(termsEntry?.priority).toBe(0.3);
    });

    it('ensures ClubInfoSection checkbox links to /terms', () => {
      const clubInfoSource = readFileSync(
        resolve(process.cwd(), 'app/(marketing)/apply/sections/ClubInfoSection.tsx'),
        'utf8'
      );
      expect(clubInfoSource).toContain('href="/terms"');
      expect(clubInfoSource).toContain('Terms of Service');
    });

    it('ensures StaffApplyForm checkbox links to /terms', () => {
      const staffApplySource = readFileSync(
        resolve(process.cwd(), 'app/(marketing)/apply/staff/StaffApplyForm.tsx'),
        'utf8'
      );
      expect(staffApplySource).toContain('href="/terms"');
      expect(staffApplySource).toContain('Terms of Service');
    });
  });
});
