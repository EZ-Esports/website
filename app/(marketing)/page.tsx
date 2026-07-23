import type { Metadata } from 'next';
import HomeHero from '@/app/components/sections/HomeHero';
import MediaGrid from '@/app/components/sections/MediaGrid';
import GameShowcase from '@/app/components/sections/GameShowcase';
import VideoShowcase from '@/app/components/sections/VideoShowcase';

import SchoolWall from '@/app/components/sections/SchoolWall';
import LeaguePulse from '@/app/components/sections/LeaguePulse';
import ScrollReveal from '@/app/components/ui/ScrollReveal';
import CutCTA from '@/app/components/ui/CutCTA';
import Section from '@/app/components/ui/Section';
import { Eyebrow } from '@/app/components/ui/SectionHeader';
import GradientRule from '@/app/components/ui/GradientRule';
import Image from 'next/image';
import {
  galleryImages1,
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
  const twitchLink = SOCIAL_LINKS.find(link => link.platform === 'twitch')?.url || 'https://www.twitch.tv/ezesportsNYC';
  let homepageContent: Record<string, string> = {};
  let primaryGallery = galleryImages1;

  try {
    homepageContent = await getCachedHomepageContent();
  } catch (error) {
    console.error('Failed to load homepage content', error);
  }

  try {
    const gallery = await getCachedHomepageGallery();
    primaryGallery = gallery.set1;
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
      <HomeHero
        title={heroTitle}
        subtitle={heroSubtitle}
        backgroundImage={heroContent.backgroundImage}
        primaryCTA={{ label: 'Watch Live', href: twitchLink, external: true }}
        secondaryCTA={{ label: heroCtaLabel, href: discordLink }}
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

      {/* 5. School Wall */}
      <ScrollReveal>
        <SchoolWall />
      </ScrollReveal>

      {/* 4. CTA Strip */}
      <Section className="border-t border-b border-accent/15">
        <div className="flex flex-col items-center gap-3">
          <Eyebrow>Get Started</Eyebrow>
          <GradientRule className="mb-1" />
          <p className="text-foreground font-semibold text-base">Ready to compete?</p>
          <div className="flex gap-4 flex-wrap justify-center">
            <CutCTA href={ROUTES.apply} variant="primary">Apply to Play</CutCTA>
            <CutCTA href={ROUTES.about} variant="outline">Learn More</CutCTA>
          </div>
        </div>
      </Section>

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
        <Section tone="sunken" className="overflow-hidden border-t border-b border-line">
          {/* Single soft glow behind the watermark — intentionally not stacked with other blurs */}
          <div className="absolute top-1/2 -right-[10%] -translate-y-1/2 w-[640px] h-[640px] rounded-full bg-accent/10 blur-[100px] pointer-events-none" />

          {/* Oversized submark watermark bleeding off the section's edge */}
          <div className="absolute top-1/2 -right-[6%] -translate-y-1/2 w-[340px] sm:w-[420px] md:w-[560px] aspect-square opacity-10 pointer-events-none select-none">
            <Image
              src="/images/submark.png"
              alt=""
              aria-hidden="true"
              fill
              sizes="560px"
              className="object-contain"
            />
          </div>

          <div className="max-w-xl relative z-10">
            <Eyebrow className="mb-3 block">About Us</Eyebrow>
            <h2 className="text-4xl sm:text-5xl font-black text-foreground tracking-tight mb-6">Our Story</h2>
            <p className="text-foreground-secondary text-lg leading-relaxed mb-8 max-w-prose">
              {storyParagraphs[0]}
            </p>
            <CutCTA href={ROUTES.about} variant="primary" className="group">
              Learn More
              <span className="inline-block transition-transform duration-200 group-hover:translate-x-1 ml-1" aria-hidden="true">→</span>
            </CutCTA>
          </div>
        </Section>
      </ScrollReveal>
    </main>
    </>
  );
}
