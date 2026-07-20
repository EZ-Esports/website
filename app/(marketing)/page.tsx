import type { Metadata } from 'next';
import Hero from '@/app/components/sections/Hero';
import MediaGrid from '@/app/components/sections/MediaGrid';
import GameShowcase from '@/app/components/sections/GameShowcase';
import VideoShowcase from '@/app/components/sections/VideoShowcase';

import SchoolWall from '@/app/components/sections/SchoolWall';
import LeaguePulse from '@/app/components/sections/LeaguePulse';
import ScrollReveal from '@/app/components/ui/ScrollReveal';
import Button from '@/app/components/ui/Button';
import Section from '@/app/components/ui/Section';
import Card from '@/app/components/ui/Card';
import { Eyebrow, SectionHeader } from '@/app/components/ui/SectionHeader';
import GradientRule from '@/app/components/ui/GradientRule';
import Image from 'next/image';
import {
  galleryImages1,
  galleryImages2,
  featuredVideos,
  heroContent,
  sectionContent,
} from '@/app/lib/homepage-data';
import { getGamesForShowcase, SITE_CONFIG, SOCIAL_LINKS, ROUTES } from '@/app/lib/constants';
import { getCachedHomepageContent, getCachedHomepageGallery } from '@/app/lib/db/queries';

export const metadata: Metadata = {
  title: 'EZ Esports — NYC High School Esports League',
  description:
    'EZ Esports is NYC\'s premier high-school esports league. Compete in Valorant, League of Legends, and Teamfight Tactics — shaping tomorrow\'s leaders through esports.',
};

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const games = getGamesForShowcase();
  const discordLink = SOCIAL_LINKS.find(link => link.platform === 'discord')?.url || 'https://discord.com/invite/RajSZqNyvu';
  let homepageContent: Record<string, string> = {};
  let primaryGallery = galleryImages1;
  let secondaryGallery = galleryImages2;

  try {
    homepageContent = await getCachedHomepageContent();
  } catch (error) {
    console.error('Failed to load homepage content', error);
  }

  try {
    const gallery = await getCachedHomepageGallery();
    primaryGallery = gallery.set1;
    secondaryGallery = gallery.set2;
  } catch (error) {
    console.error('Failed to load homepage gallery', error);
  }

  const heroTitle = homepageContent['hero.title']?.trim() || heroContent.title;
  const heroSubtitle = homepageContent['hero.subtitle']?.trim() || SITE_CONFIG.description;
  const heroCtaLabel = homepageContent['hero.cta']?.trim() || 'Join Discord';
  const storyBlurb = homepageContent.home_about_blurb?.trim();
  const storyParagraphs = storyBlurb
    ? [storyBlurb, ...sectionContent.ourStory.paragraphs.slice(1)]
    : sectionContent.ourStory.paragraphs;

  return (
    <>
      <main>
      {/* 1. Hero Section */}
      <Hero
        title={heroTitle}
        subtitle={heroSubtitle}
        backgroundImage={heroContent.backgroundImage}
        size="large"
        primaryCTA={{ label: heroCtaLabel, href: discordLink }}
      />



      {/* 3. Competition Games */}
      <ScrollReveal>
        <GameShowcase
          title={sectionContent.gameShowcase.title}
          games={games}
        />
      </ScrollReveal>

      {/* 3.5 League Pulse: latest results across games */}
      <ScrollReveal>
        <LeaguePulse />
      </ScrollReveal>

      {/* 4. CTA Strip */}
      <Section className="border-t border-b border-accent/15">
        <div className="flex flex-col items-center gap-3">
          <Eyebrow>Get Started</Eyebrow>
          <GradientRule className="mb-1" />
          <p className="text-foreground font-semibold text-base">Ready to compete?</p>
          <div className="flex gap-4 flex-wrap justify-center">
            <Button href={ROUTES.apply} variant="primary">Apply to Play</Button>
            <Button href={ROUTES.about} variant="secondary">Learn More</Button>
          </div>
        </div>
      </Section>

      {/* 5. School Wall */}
      <ScrollReveal>
        <SchoolWall />
      </ScrollReveal>

      {/* 6. Photo Gallery #1 */}
      {primaryGallery.length > 0 && (
        <ScrollReveal>
          <MediaGrid
            items={primaryGallery}
            columns={3}
            eyebrow="Gallery"
            heading="Community in Action"
          />
        </ScrollReveal>
      )}

      {/* 7. Video Showcase */}
      <ScrollReveal>
        <VideoShowcase
          videos={featuredVideos}
          description={sectionContent.videoShowcase.description}
        />
      </ScrollReveal>



      {/* 9. Our Story */}
      <ScrollReveal>
        <Section tone="raised" className="overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[120px] pointer-events-none" />
          <div className="max-w-5xl mx-auto relative z-10">
            <Card variant="raised" padding="lg" className="border border-line/50 bg-gradient-to-br from-surface-raised/80 via-surface/40 to-surface-raised/80 backdrop-blur-md relative overflow-hidden flex flex-col md:flex-row items-center gap-10 md:gap-16">
              {/* Subtle light leak on the card corner */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex-1 space-y-6 text-left relative z-10">
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-accent/80 block">Our Roots</span>
                  <h2 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">Our Story</h2>
                </div>
                
                <p className="text-foreground-secondary text-base sm:text-lg font-medium leading-relaxed">
                  {storyParagraphs[0]}
                </p>
                
                <div className="pt-2">
                  <Button href={ROUTES.about} variant="primary" className="group">
                    Learn More 
                    <span className="inline-block transition-transform duration-200 group-hover:translate-x-1 ml-1" aria-hidden="true">→</span>
                  </Button>
                </div>
              </div>

              <div className="w-full md:w-[320px] shrink-0 flex justify-center relative select-none">
                {/* Glowing ring behind the submark */}
                <div className="absolute inset-0 bg-accent/15 rounded-full blur-2xl scale-75 pointer-events-none" />
                <div className="relative w-48 h-48 sm:w-56 sm:h-56 transition-transform duration-500 hover:scale-105">
                  <Image
                    src="/images/submark.png"
                    alt="EZ Esports Submark"
                    fill
                    sizes="224px"
                    className="object-contain opacity-90 drop-shadow-[0_0_20px_rgba(244,204,204,0.15)]"
                  />
                </div>
              </div>
            </Card>
          </div>
        </Section>
      </ScrollReveal>
    </main>
    </>
  );
}
