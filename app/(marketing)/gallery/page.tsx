import type { Metadata } from 'next';
import Hero from '@/app/components/sections/Hero';
import Section from '@/app/components/ui/Section';
import { SectionHeader } from '@/app/components/ui/SectionHeader';
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
    </main>
  );
}
