'use client';

import Hero from '@/app/components/sections/Hero';
import ContentSection from '@/app/components/sections/ContentSection';
import MediaGrid from '@/app/components/sections/MediaGrid';
import GameShowcase from '@/app/components/sections/GameShowcase';
import VideoShowcase from '@/app/components/sections/VideoShowcase';
import SocialBar from '@/app/components/sections/SocialBar';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import {
  galleryImages1,
  galleryImages2,
  featuredVideos,
  heroContent,
  sectionContent,
} from '@/app/lib/homepage-data';
import { getGamesForShowcase, SITE_CONFIG } from '@/app/lib/constants';

export default function HomePage() {
  const games = getGamesForShowcase();

  return (
    <>
      <LoadingScreen />
      <main>
      {/* 1. Hero Section */}
      <Hero
        title={heroContent.title}
        subtitle={SITE_CONFIG.description}
        backgroundImage={heroContent.backgroundImage}
        size="large"
      />

      {/* 2. Live Streaming Section */}
      <ContentSection
        heading={sectionContent.liveStreaming.heading}
        description={sectionContent.liveStreaming.description}
        theme="dark"
      />

      {/* 3. Photo Gallery #1 */}
      <MediaGrid items={galleryImages1} columns={3} theme="dark" />

      {/* 5. Video Showcase */}
      <VideoShowcase
        videos={featuredVideos}
        description={sectionContent.videoShowcase.description}
      />

      {/* 6. Photo Gallery #2 */}
      <MediaGrid items={galleryImages2} columns={2} theme="dark" />

      {/* 7. Social Bar */}
      <SocialBar theme="light" />

      {/* 8. Competition Games */}
      <GameShowcase
        title={sectionContent.gameShowcase.title}
        games={games}
      />

      {/* 9. Our Story */}
      <ContentSection
        heading={sectionContent.ourStory.heading}
        description=""
        theme="dark"
      >
        <div className="max-w-4xl mx-auto space-y-4 text-lg leading-relaxed text-center">
          {sectionContent.ourStory.paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </ContentSection>
    </main>
    </>
  );
}


