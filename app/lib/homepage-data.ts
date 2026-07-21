import type { Image, VideoItem } from '@/app/types';

// ============================================================================
// Homepage Data
// ============================================================================

// Gallery images - first set (11 images)
export const galleryImages1: Image[] = [
  { id: 'gallery-1', src: '/images/gallery/gallery-1.png', alt: 'EZ Esports players competing at a NYC high school event' },
  { id: 'gallery-2', src: '/images/gallery/gallery-2.png', alt: 'Students gathered at an EZ Esports league match' },
  { id: 'gallery-3', src: '/images/gallery/gallery-3.png', alt: 'EZ Esports team celebrating a victory' },
  { id: 'gallery-4', src: '/images/gallery/gallery-4.png', alt: 'High school esports competitors at their stations' },
  { id: 'gallery-5', src: '/images/gallery/gallery-5.png', alt: 'EZ Esports NYC league event crowd' },
  { id: 'gallery-6', src: '/images/gallery/gallery-6.png', alt: 'Players focused during an EZ Esports match' },
  { id: 'gallery-7', src: '/images/gallery/gallery-7.png', alt: 'EZ Esports community meetup at a NYC venue' },
  { id: 'gallery-8', src: '/images/gallery/gallery-8.png', alt: 'Students competing in Valorant at EZ Esports' },
  { id: 'gallery-9', src: '/images/gallery/gallery-9.png', alt: 'EZ Esports broadcast team running a live stream' },
  { id: 'gallery-10', src: '/images/gallery/gallery-10.png', alt: 'EZ Esports end-of-season celebration' },
  { id: 'gallery-11', src: '/images/gallery/gallery-11.png', alt: 'NYC high school teams lined up before an EZ Esports finals match' },
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
  backgroundImage: '/images/hero-background.jpg',
} as const;

// Section content
export const sectionContent = {
  videoShowcase: {
    description: 'We live-stream our matches each season, bringing the excitement of high school esports to students, families, and fans across New York City.',
  },
  gameShowcase: {
    title: 'Compete Against Other Students Across NYC',
  },
  ourStory: {
    heading: 'Our Story',
    paragraphs: [
      'EZ Esports was founded in November 2021 and developed by various NYC high school student club officers to provide their club members opportunity to compete in an accessible and organized esports league.',
      'Our mission is to provide competitive esports opportunities to NYC high school students, building community, developing skills, and creating pathways to careers in gaming and technology. We believe that esports can be a powerful tool for student engagement, skill development, and career preparation.',
      'Through our organized leagues, live streaming infrastructure, and community events, we bring together students from across New York City to compete, learn, and grow together. Our platform showcases student talent and builds lasting connections between schools, students, and the broader esports community.',
    ],
  },
} as const;
