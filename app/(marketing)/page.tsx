import type { Metadata } from 'next';
import Hero from '@/app/components/sections/Hero';
import ContentSection from '@/app/components/sections/ContentSection';
import MediaGrid from '@/app/components/sections/MediaGrid';
import GameShowcase from '@/app/components/sections/GameShowcase';
import VideoShowcase from '@/app/components/sections/VideoShowcase';
import SocialBar from '@/app/components/sections/SocialBar';
import AudienceCTAs from '@/app/components/sections/AudienceCTAs';
import SchoolWall from '@/app/components/sections/SchoolWall';
import LeaguePulse from '@/app/components/sections/LeaguePulse';
import ScrollReveal from '@/app/components/ui/ScrollReveal';
import Button from '@/app/components/ui/Button';
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

      {/* 2. Audience CTAs */}
      <AudienceCTAs />

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
      <div className="bg-background py-10 flex flex-col items-center gap-3 border-t border-b border-ez-pink/15">
        <span className="text-ez-pink uppercase tracking-widest text-xs font-bold">Get Started</span>
        <div className="w-8 h-0.5 bg-gradient-to-r from-ez-pink to-ez-purple mb-1" />
        <p className="text-foreground font-semibold text-base">Ready to compete?</p>
        <div className="flex gap-4 flex-wrap justify-center">
          <Button href={ROUTES.apply} variant="primary">Apply to Play</Button>
          <Button href={ROUTES.about} variant="secondary">Learn More</Button>
        </div>
      </div>

      {/* 5. School Wall */}
      <ScrollReveal>
        <SchoolWall />
      </ScrollReveal>

      {/* 6. Photo Gallery #1 */}
      {primaryGallery.length > 0 && (
        <ScrollReveal>
          <MediaGrid items={primaryGallery} columns={3} theme="dark" />
        </ScrollReveal>
      )}

      {/* 7. Video Showcase */}
      <ScrollReveal>
        <VideoShowcase
          videos={featuredVideos}
          description={sectionContent.videoShowcase.description}
        />
      </ScrollReveal>

      {/* 8. Photo Gallery #2 */}
      {secondaryGallery.length > 0 && (
        <ScrollReveal>
          <MediaGrid items={secondaryGallery} columns={2} theme="dark" />
        </ScrollReveal>
      )}

      {/* 9. Our Story */}
      <ScrollReveal>
        <ContentSection
          eyebrow="About Us"
          heading="Our Story"
          description=""
          theme="dark"
        >
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 space-y-6 text-lg leading-relaxed text-left">
              {storyParagraphs.map((paragraph, index) => (
                <p key={index} className="text-foreground-secondary">{paragraph}</p>
              ))}
              <div className="pt-4">
                <Button href={ROUTES.about} variant="primary">
                  Read Full Story
                </Button>
              </div>
            </div>
            <div className="flex-1 relative w-full aspect-square max-w-md">
              <div className="absolute inset-0 bg-ez-pink/20 rounded-full blur-3xl" />
              <Image
                src="/images/submark.png"
                alt="EZ Esports Submark"
                fill
                sizes="(max-width: 768px) 80vw, 448px"
                className="object-contain relative z-10 opacity-80"
              />
            </div>
          </div>
        </ContentSection>
      </ScrollReveal>

      {/* 10. Social Bar */}
      <ScrollReveal>
        <SocialBar theme="dark" />
      </ScrollReveal>
    </main>
    </>
  );
}
