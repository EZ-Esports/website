import type { Metadata } from 'next';
import Hero from '@/app/components/sections/Hero';
import Section from '@/app/components/ui/Section';
import { SectionHeader, Eyebrow } from '@/app/components/ui/SectionHeader';
import CutCTA from '@/app/components/ui/CutCTA';
import GalleryGrid from './GalleryGrid';
import { galleryImages1 } from '@/app/lib/homepage-data';
import { getCachedHomepageGallery } from '@/app/lib/db/queries';

export const metadata: Metadata = {
  title: 'Community Gallery | EZ Esports',
  description:
    'Photos of NYC high school esports tournaments, LANs, and student meetups across the five boroughs.',
  openGraph: {
    title: 'Community Gallery | EZ Esports',
    description:
      'Photos of NYC high school esports tournaments, LANs, and student meetups across the five boroughs.',
    images: ['/images/hero-background.jpg'],
  },
};

export const dynamic = 'force-dynamic';

export default async function GalleryPage() {
  let galleryItems = galleryImages1;

  try {
    const gallery = await getCachedHomepageGallery();
    if (gallery?.set1 && gallery.set1.length > 0) {
      galleryItems = gallery.set1;
    }
  } catch (error) {
    console.error('Failed to load gallery images', error);
  }

  return (
    <main>
      {/* 1. Hero Header */}
      <Hero
        title="Community Gallery"
        subtitle="Photos of NYC high school esports tournaments, LANs, and student meetups across the five boroughs."
        backgroundImage="/images/hero-background.jpg"
        size="medium"
      />

      {/* 2. Photo Gallery Grid Section */}
      <Section tone="default" width="wide">
        <SectionHeader
          eyebrow="Community Moments"
          title="NYC High School Esports in Action"
          lead="Explore moments captured across our seasonal tournaments, five-borough LAN championships, watch parties, and student esports meetups."
        />
        <GalleryGrid items={galleryItems} />
      </Section>

      {/* 3. Event Photo Submissions CTA Section */}
      <Section tone="sunken" className="border-t border-line">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <Eyebrow className="inline-block">Submit Event Photos</Eyebrow>
          <h2 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
            Have Photos From An EZ Esports Event?
          </h2>
          <p className="text-foreground-secondary text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
            Were you at an EZ Esports tournament, LAN party, or school meetup? We welcome photo submissions from students, coaches, photographers, and fans to feature in our community gallery.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <CutCTA href="https://discord.com/invite/RajSZqNyvu" external variant="primary">
              Submit via Discord
            </CutCTA>
            <CutCTA href="mailto:info@ezesports.org" external variant="outline">
              Email Photo Desk
            </CutCTA>
          </div>
          <p className="text-xs text-foreground-muted">
            Please include school name, event date, and photographer credit with your submission.
          </p>
        </div>
      </Section>
    </main>
  );
}
