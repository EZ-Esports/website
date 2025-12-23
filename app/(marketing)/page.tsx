import Hero from '@/app/components/sections/Hero';
import ContentSection from '@/app/components/sections/ContentSection';
import MediaGrid from '@/app/components/sections/MediaGrid';
import GameShowcase from '@/app/components/sections/GameShowcase';
import VideoShowcase from '@/app/components/sections/VideoShowcase';
import SocialBar from '@/app/components/sections/SocialBar';
import { SEASON_INFO, SOCIAL_LINKS } from '@/app/lib/constants';
import Link from 'next/link';

function SocialIcon({ platform }: { platform: string }) {
  const getInitial = (platform: string): string => {
    const initials: Record<string, string> = {
      discord: 'D',
      instagram: 'I',
      messenger: 'M',
    };
    return initials[platform.toLowerCase()] || platform[0].toUpperCase();
  };

  return (
    <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-white text-sm font-semibold hover:bg-gray-700 transition-colors">
      {getInitial(platform)}
    </div>
  );
}

export default function HomePage() {
  // Gallery images
  const galleryImages1 = Array.from({ length: 9 }, (_, i) => ({
    src: `/images/gallery-${i + 1}.png`,
    alt: `Event photo ${i + 1}`,
  }));

  const galleryImages2 = [
    { src: '/images/gallery-10.png', alt: 'Event photo 10' },
    { src: '/images/gallery-11.png', alt: 'Event photo 11' },
  ];

  const games = [
    { title: 'League of Legends', imageUrl: '/images/lol-banner.png' },
    { title: 'Valorant', imageUrl: '/images/val-banner.png' },
    { title: 'Tactical Fight Tatics', imageUrl: '/images/tft-banner.png' },
  ];

  const videos = [
    {
      videoId: 'Sr7MF9YMQaI',
      title: 'ACE FOR OT?? - February 11, 2022 - Stuyvesant (6-0) vs. Bronx Science (6-0)',
    },
    {
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
        description="Get live broadcasts from schools on 300+ concurrent streams"
        theme="dark"
      />

      {/* 3. Photo Gallery #1 */}
      <MediaGrid items={galleryImages1} columns={3} theme="dark" />

      {/* 4. Mission Statement */}
      <ContentSection
        heading="Building Tomorrow's Workforce"
        description="Building tomorrow's workforce through their passion for esports today"
        theme="light"
        imagePosition="left"
      >
        <div className="space-y-6">
          <div className="border-2 border-gray-900 p-6 rounded-lg">
            <p className="text-2xl font-bold mb-2">{SEASON_INFO.name}</p>
            <div className="space-y-2">
              <div className="border border-gray-900 p-3 rounded">
                <p className="text-sm text-gray-600">Start:</p>
                <p className="font-semibold">{SEASON_INFO.startDate}</p>
              </div>
              <div className="border border-gray-900 p-3 rounded">
                <p className="text-sm text-gray-600">End:</p>
                <p className="font-semibold">{SEASON_INFO.endDate}</p>
              </div>
            </div>
          </div>
          <div>
            <p className="text-lg font-semibold mb-4">Connect us!</p>
            <div className="flex gap-3">
              {SOCIAL_LINKS.filter((s) => ['discord', 'instagram', 'messenger'].includes(s.platform)).map((social) => (
                <Link
                  key={social.platform}
                  href={social.url}
                  aria-label={social.label}
                  className="focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 rounded-full"
                >
                  <SocialIcon platform={social.platform} />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </ContentSection>

      {/* 5. Video Showcase */}
      <VideoShowcase
        videos={videos}
        description="Our live broadcasts have reached over 300 concurrent streams, bringing the excitement of high school esports to audiences across New York City. We provide professional-grade streaming infrastructure that showcases student talent and builds community around competitive gaming."
        reportLink="#report"
        sizzleLink="#sizzle"
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


