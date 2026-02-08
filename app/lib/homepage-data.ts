import type { Image, VideoItem } from '@/app/types';

// ============================================================================
// Homepage Data
// ============================================================================

// Gallery images - first set (9 images)
export const galleryImages1: Image[] = Array.from({ length: 9 }, (_, i) => ({
  id: `gallery-${i + 1}`,
  src: `/images/gallery/gallery-${i + 1}.png`,
  alt: `Event photo ${i + 1}`,
}));

// Gallery images - second set (2 images)
export const galleryImages2: Image[] = [
  { id: 'gallery-10', src: '/images/gallery/gallery-10.png', alt: 'Event photo 10' },
  { id: 'gallery-11', src: '/images/gallery/gallery-11.png', alt: 'Event photo 11' },
];

// Featured videos
export const featuredVideos: VideoItem[] = [
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

// Hero section content
export const heroContent = {
  title: 'New York City High School Esports League',
  backgroundImage: '/images/hero-background.png',
} as const;

// Section content
export const sectionContent = {
  liveStreaming: {
    heading: 'Live Streaming on Twitch.tv',
    description: 'Get live broadcasts from schools on 500+ concurrent streams',
  },
  videoShowcase: {
    description: 'Our live broadcasts have reached over 500 concurrent viewers, bringing the excitement of high school esports to audiences across New York City.',
  },
  gameShowcase: {
    title: 'Compete Against Other Students Across NYC',
  },
  ourStory: {
    heading: 'OUR STORY',
    paragraphs: [
      'EZ Esports was founded in November 2021 and developed by various NYC high school student club officers to provide their club members opportunity to compete in an accessible and organized esports league.',
      'Our mission is to provide competitive esports opportunities to NYC high school students, building community, developing skills, and creating pathways to careers in gaming and technology. We believe that esports can be a powerful tool for student engagement, skill development, and career preparation.',
      'Through our organized leagues, live streaming infrastructure, and community events, we bring together students from across New York City to compete, learn, and grow together. Our platform showcases student talent and builds lasting connections between schools, students, and the broader esports community.',
    ],
  },
} as const;
