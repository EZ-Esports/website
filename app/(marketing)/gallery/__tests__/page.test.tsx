import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import GalleryPage, { metadata } from '../page';
import MediaGrid from '@/app/components/sections/MediaGrid';
import { FOOTER_LINKS, ROUTES } from '@/app/lib/constants';
import sitemap from '@/app/sitemap';
import type { Image as ImageType } from '@/app/types';

// Mock DB queries so tests run purely in-memory without database connection
vi.mock('@/app/lib/db/queries', () => ({
  getCachedHomepageGallery: vi.fn().mockResolvedValue({
    set1: [
      { id: 'img-1', src: '/images/gallery/test-1.png', alt: 'Test Photo 1: Valorant Tournament' },
      { id: 'img-2', src: '/images/gallery/test-2.png', alt: 'Test Photo 2: LAN Finals Arena' },
    ],
  }),
}));

describe('Community Gallery Page & Showcase Integration (/gallery)', () => {
  describe('Homepage Showcase CTA', () => {
    const mockItems: ImageType[] = [
      { id: '1', src: '/images/gallery/gallery-1.png', alt: 'Championship Match' },
      { id: '2', src: '/images/gallery/gallery-2.png', alt: 'LAN Party Crowd' },
    ];

    it('renders the "View Full Gallery →" CTA in MediaGrid linking to /gallery', () => {
      const html = renderToStaticMarkup(
        <MediaGrid items={mockItems} eyebrow="Gallery" heading="Community in Action" />
      );

      expect(html).toContain('href="/gallery"');
      expect(html).toContain('View Full Gallery');
      expect(html).toContain('→');
    });

    it('allows hiding the CTA via showCta prop', () => {
      const html = renderToStaticMarkup(
        <MediaGrid items={mockItems} showCta={false} />
      );

      expect(html).not.toContain('View Full Gallery');
    });

    it('verifies homepage page.tsx includes MediaGrid showcase section', () => {
      const pageSource = readFileSync(
        resolve(process.cwd(), 'app/(marketing)/page.tsx'),
        'utf8'
      );
      expect(pageSource).toContain('<MediaGrid');
      expect(pageSource).toContain('primaryGallery');
      expect(pageSource).toContain('heading="Community in Action"');
    });
  });

  describe('Gallery Page Metadata & Structure', () => {
    it('exports valid metadata with title and description', () => {
      expect(metadata.title).toBe('Community Gallery | EZ Esports');
      expect(metadata.description).toContain('NYC high school esports tournaments');
      expect(metadata.description).toContain('LANs');
      expect(metadata.description).toContain('student meetups');
    });

    it('renders the Hero header with Community Gallery title and descriptive subtitle', async () => {
      const jsx = await GalleryPage();
      const html = renderToStaticMarkup(jsx);

      expect(html).toContain('Community Gallery');
      expect(html).toContain('NYC high school esports tournaments, LANs, and student meetups');
    });

    it('renders gallery items with captions and image sources', async () => {
      const jsx = await GalleryPage();
      const html = renderToStaticMarkup(jsx);

      // Check for mocked items rendered in the grid
      expect(html).toContain('Test Photo 1: Valorant Tournament');
      expect(html).toContain('Test Photo 2: LAN Finals Arena');
      expect(html).toContain('/images/gallery/test-1.png');
      expect(html).toContain('/images/gallery/test-2.png');
    });

    it('renders interactive photo buttons with accessible labels', async () => {
      const jsx = await GalleryPage();
      const html = renderToStaticMarkup(jsx);

      expect(html).toContain('aria-label="View photo: Test Photo 1: Valorant Tournament"');
      expect(html).toContain('aria-label="View photo: Test Photo 2: LAN Finals Arena"');
      expect(html).toContain('View Photo');
    });

    it('renders the event photo submissions CTA and note', async () => {
      const jsx = await GalleryPage();
      const html = renderToStaticMarkup(jsx);

      expect(html).toContain('Have Photos From An EZ Esports Event?');
      expect(html).toContain('Submit Event Photos');
      expect(html).toContain('Submit via Discord');
      expect(html).toContain('Email Photo Desk');
      expect(html).toContain('https://discord.com/invite/RajSZqNyvu');
      expect(html).toContain('mailto:info@ezesports.org');
      expect(html).toContain('Please include school name, event date, and photographer credit');
    });
  });

  describe('Navigation, Constants & Sitemap Integration', () => {
    it('includes ROUTES.gallery defined as /gallery', () => {
      expect(ROUTES.gallery).toBe('/gallery');
    });

    it('includes Gallery in FOOTER_LINKS linking to /gallery', () => {
      const galleryFooterLink = FOOTER_LINKS.find((link) => link.href === '/gallery');
      expect(galleryFooterLink).toBeDefined();
      expect(galleryFooterLink?.label).toBe('Gallery');
    });

    it('includes /gallery in staticRoutes in sitemap', () => {
      const entries = sitemap();
      const galleryEntry = entries.find((entry) => entry.url.endsWith('/gallery'));
      expect(galleryEntry).toBeDefined();
      expect(galleryEntry?.priority).toBe(0.8);
      expect(galleryEntry?.changeFrequency).toBe('weekly');
    });

    it('ensures MainContentWrapper recognizes /gallery in hasHero', () => {
      const wrapperSource = readFileSync(
        resolve(process.cwd(), 'app/(marketing)/MainContentWrapper.tsx'),
        'utf8'
      );
      expect(wrapperSource).toContain("pathname === '/gallery'");
    });

    it('ensures Header recognizes /gallery in hasHero', () => {
      const headerSource = readFileSync(
        resolve(process.cwd(), 'app/components/layout/Header.tsx'),
        'utf8'
      );
      expect(headerSource).toContain("pathname === '/gallery'");
    });
  });
});
