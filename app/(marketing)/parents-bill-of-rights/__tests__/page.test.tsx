import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import ParentsBillOfRightsPage, { metadata } from '../page';
import { FOOTER_LINKS, ROUTES } from '@/app/lib/constants';
import sitemap from '@/app/sitemap';

// Mock Hero if needed since Hero uses client-side motion hooks
vi.mock('@/app/components/sections/Hero', () => ({
  default: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <header data-testid="mock-hero">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </header>
  ),
}));

describe("Parents' Bill of Rights Page", () => {
  describe('Metadata', () => {
    it('exports appropriate metadata with title and description', () => {
      expect(metadata.title).toContain("Parents' Bill of Rights for Data Privacy and Security");
      expect(metadata.title).toContain('EZ Esports');
      expect(metadata.description).toContain('New York State Education Law § 2-D');
      expect(metadata.description).toContain('8 NYCRR Part 121');
    });
  });

  describe('Page Content & Legal Compliance', () => {
    const html = renderToStaticMarkup(<ParentsBillOfRightsPage />);

    it('renders the Hero with the correct title and statutory subtitle', () => {
      expect(html).toContain("Parents&#x27; Bill of Rights for Data Privacy and Security");
      expect(html).toContain('New York State Education Law § 2-D');
      expect(html).toContain('8 NYCRR Part 121');
    });

    it('includes Preamble referencing NYS Ed Law § 2-D, 8 NYCRR Part 121, and FERPA', () => {
      expect(html).toContain('Preamble &amp; Legal Framework');
      expect(html).toContain('New York State Education Law § 2-D');
      expect(html).toContain('8 NYCRR Part 121');
      expect(html).toContain('FERPA');
    });

    it('includes Section 1: Student PII Protections with commercial use prohibitions', () => {
      expect(html).toContain('1. Student PII Protections');
      expect(html).toContain('Never Sold or Commercialized');
      expect(html).toMatch(/never sold, rented, leased, or released for any commercial/i);
      expect(html).toContain('Exclusive Educational Purpose');
      expect(html).toContain('Vendor &amp; Subcontractor Obligations');
    });

    it('includes Section 2: Parent & Eligible Student Rights', () => {
      expect(html).toContain('2. Parent &amp; Eligible Student Rights');
      expect(html).toContain('Right to Inspect &amp; Review');
      expect(html).toContain('Right to Request Correction');
      expect(html).toContain('http://www.nysed.gov/data-privacy-security/student-data-inventory');
    });

    it('includes Section 3: Data Security & Technical Safeguards aligned with NIST CSF and modern encryption', () => {
      expect(html).toContain('3. Data Security &amp; Technical Safeguards');
      expect(html).toContain('National Institute of Standards and Technology (NIST) Cybersecurity Framework (CSF)');
      expect(html).toContain('8 NYCRR § 121.5');
      expect(html).toContain('Encryption in Transit');
      expect(html).toContain('TLS 1.2 and TLS 1.3');
      expect(html).toContain('Encryption at Rest');
      expect(html).toContain('AES-256');
      expect(html).toContain('Least Privilege');
    });

    it('includes Section 4: Data Incident & Breach Notification with 7-day commitment', () => {
      expect(html).toContain('4. Data Incident &amp; Breach Notification');
      expect(html).toContain('Prompt Agency Notification');
      expect(html).toContain('seven (7) calendar days');
      expect(html).toContain('8 NYCRR § 121.11(a)');
    });

    it('includes Section 5: Supplemental Information for Third-Party Contractors', () => {
      expect(html).toContain('5. Third-Party Contractor Supplemental Information');
      expect(html).toContain('New York State Education Law § 2-D');
      expect(html).toContain('8 NYCRR § 121.3(c)');
    });

    it('includes Section 6: Designated Privacy Officer and complaint filing with NYSED Chief Privacy Officer', () => {
      expect(html).toContain('6. Designated Privacy Officer &amp; Complaint Process');
      expect(html).toContain('privacy@ezesports.org');
      expect(html).toContain('mailto:privacy@ezesports.org');
      expect(html).toContain('Chief Privacy Officer, New York State Education Department');
      expect(html).toContain('CPO@nysed.gov');
      expect(html).toContain('mailto:CPO@nysed.gov');
      expect(html).toContain('https://www.nysed.gov/data-privacy-security/report-improper-disclosure');
    });

    it('cross-links to the general Privacy Policy', () => {
      expect(html).toContain('/privacy');
      expect(html).toContain('Privacy Policy');
    });
  });

  describe('Integration with Navigation, Constants & Sitemap', () => {
    it('is registered in ROUTES constant', () => {
      expect(ROUTES.parentsBillOfRights).toBe('/parents-bill-of-rights');
    });

    it('is included in FOOTER_LINKS', () => {
      const footerEntry = FOOTER_LINKS.find((link) => link.href === '/parents-bill-of-rights');
      expect(footerEntry).toBeDefined();
      expect(footerEntry?.label).toBe("Parents' Bill of Rights");
    });

    it('is included in staticRoutes within sitemap', () => {
      const routes = sitemap();
      const sitemapEntry = routes.find((entry) => entry.url.endsWith('/parents-bill-of-rights'));
      expect(sitemapEntry).toBeDefined();
      expect(sitemapEntry?.priority).toBe(0.3);
      expect(sitemapEntry?.changeFrequency).toBe('yearly');
    });

    it('is cross-linked from the Privacy Policy page', () => {
      const privacySource = readFileSync(
        resolve(__dirname, '../../privacy/page.tsx'),
        'utf8'
      );
      expect(privacySource).toContain('/parents-bill-of-rights');
      expect(privacySource).toContain("Parents&apos; Bill of Rights for Data Privacy and Security");
      expect(privacySource).toContain('Student Privacy &amp; Scholastic Records');
    });

    it('is registered in hasHero list in MainContentWrapper and Header', () => {
      const wrapperSource = readFileSync(
        resolve(__dirname, '../../MainContentWrapper.tsx'),
        'utf8'
      );
      const headerSource = readFileSync(
        resolve(__dirname, '../../../components/layout/Header.tsx'),
        'utf8'
      );

      expect(wrapperSource).toContain("pathname === '/parents-bill-of-rights'");
      expect(headerSource).toContain("pathname === '/parents-bill-of-rights'");
    });
  });
});
