import Hero from '@/app/components/sections/Hero';
import ContentSection from '@/app/components/sections/ContentSection';
import MediaGrid from '@/app/components/sections/MediaGrid';
import GameShowcase from '@/app/components/sections/GameShowcase';
import VideoShowcase from '@/app/components/sections/VideoShowcase';
import SocialBar from '@/app/components/sections/SocialBar';
import type { Image, Game, VideoItem } from '@/app/types';

export default function HomePage() {
  // Gallery images
  const galleryImages1: Image[] = Array.from({ length: 9 }, (_, i) => ({
    id: `gallery-${i + 1}`,
    src: `/images/gallery/gallery-${i + 1}.png`,
    alt: `Event photo ${i + 1}`,
  }));

  const galleryImages2: Image[] = [
    { id: 'gallery-10', src: '/images/gallery/gallery-10.png', alt: 'Event photo 10' },
    { id: 'gallery-11', src: '/images/gallery/gallery-11.png', alt: 'Event photo 11' },
  ];

  const games: Game[] = [
    { id: 'lol', title: 'League of Legends', imageUrl: '/images/lol-banner.png' },
    { id: 'val', title: 'Valorant', imageUrl: '/images/val-banner.png' },
    { id: 'tft', title: 'Tactical Fight Tatics', imageUrl: '/images/tft-banner.png' },
  ];

  const videos: VideoItem[] = [
    {
      id: 'video-1',
      videoId: 'Sr7MF9YMQaI',
      title: 'ACE FOR OT?? - February 11, 2022 - Stuyvesant (6-0) vs. Bronx Science (6-0)',
    },
    {
      id: 'video-2',
      videoId: 'g03Fg6ofrAU',
      title: 'Midline Event at Long Island University - August 15, 2022',
    },
  ];

  return (
    <main>
      {/* 1. Hero Section */}
      <Hero
        title="New York City High School Esports League"
        backgroundImage="/images/hero-background.png"
      />

      {/* 2. Live Streaming Section */}
      <ContentSection
        heading="Live Streaming on Twitch.tv"
        description="Get live broadcasts from schools on 500+ concurrent streams"
        theme="dark"
      />

      {/* 3. Photo Gallery #1 */}
      <MediaGrid items={galleryImages1} columns={3} theme="dark" />

      {/* 5. Video Showcase */}
      <VideoShowcase
        videos={videos}
        description="Our live broadcasts have reached over 500 concurrent viewers, bringing the excitement of high school esports to audiences across New York City."
      />

      {/* 6. Photo Gallery #2 */}
      <MediaGrid items={galleryImages2} columns={2} theme="dark" />

      {/* 7. Social Bar */}
      <SocialBar theme="light" />

      {/* 8. Competition Games */}
      <GameShowcase
        title="Compete Against Other Students Across NYC"
        games={games}
      />

      {/* 9. Our Story */}
      <ContentSection
        heading="OUR STORY"
        description=""
        theme="dark"
      >
        <div className="max-w-4xl mx-auto space-y-4 text-lg leading-relaxed text-center">
          <p>
            EZ Esports was founded in November 2021 and developed by various NYC high school student club officers to provide their club members opportunity to compete in an accessible and organized esports league.
          </p>
          <p>
            Our mission is to provide competitive esports opportunities to NYC high school students, building community, developing skills, and creating pathways to careers in gaming and technology. We believe that esports can be a powerful tool for student engagement, skill development, and career preparation.
          </p>
          <p>
            Through our organized leagues, live streaming infrastructure, and community events, we bring together students from across New York City to compete, learn, and grow together. Our platform showcases student talent and builds lasting connections between schools, students, and the broader esports community.
          </p>
        </div>
      </ContentSection>
    </main>
  );
}


