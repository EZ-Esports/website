'use client';

import Hero from '@/app/components/sections/Hero';
import ContentSection from '@/app/components/sections/ContentSection';
import MediaGrid from '@/app/components/sections/MediaGrid';
import GameShowcase from '@/app/components/sections/GameShowcase';
import VideoShowcase from '@/app/components/sections/VideoShowcase';
import SocialBar from '@/app/components/sections/SocialBar';
import AudienceCTAs from '@/app/components/sections/AudienceCTAs';
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

export default function HomePage() {
  const games = getGamesForShowcase();
  const discordLink = SOCIAL_LINKS.find(link => link.platform === 'discord')?.url || '#';

  return (
    <>
      <main id="main-content">
      {/* 1. Hero Section */}
      <Hero
        title={heroContent.title}
        subtitle={SITE_CONFIG.description}
        backgroundImage={heroContent.backgroundImage}
        size="large"
        primaryCTA={{ label: 'Join Discord', href: discordLink }}
      />

      <AudienceCTAs />

      {/* 3. Photo Gallery #1 */}
      <ScrollReveal>
        <MediaGrid items={galleryImages1} columns={3} theme="dark" />
      </ScrollReveal>

      {/* 5. Video Showcase */}
      <ScrollReveal>
        <VideoShowcase
          videos={featuredVideos}
          description={sectionContent.videoShowcase.description}
        />
      </ScrollReveal>

      {/* 6. Photo Gallery #2 */}
      <ScrollReveal>
        <MediaGrid items={galleryImages2} columns={2} theme="dark" />
      </ScrollReveal>

      {/* 7. Social Bar */}
      <ScrollReveal>
        <SocialBar theme="light" />
      </ScrollReveal>

      {/* 8. Competition Games */}
      <ScrollReveal>
        <GameShowcase
          title={sectionContent.gameShowcase.title}
          games={games}
        />
      </ScrollReveal>

      {/* 9. Our Story */}
      <ScrollReveal>
        <ContentSection
          heading={sectionContent.ourStory.heading}
          description=""
          theme="dark"
        >
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 space-y-6 text-lg leading-relaxed text-left">
              {sectionContent.ourStory.paragraphs.map((paragraph, index) => (
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
                className="object-contain relative z-10 opacity-80"
              />
            </div>
          </div>
        </ContentSection>
      </ScrollReveal>
    </main>
    </>
  );
}


