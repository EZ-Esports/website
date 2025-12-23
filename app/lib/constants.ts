import type { NavigationItem, SocialLink } from '@/app/types';

export const SITE_CONFIG = {
  name: 'NYC High School Esports League',
  company: 'EZ Esports',
  description: 'Shaping the leaders of tomorrow through their passion for esports today.',
} as const;

export const NAV_ITEMS: NavigationItem[] = [
  { label: 'EZ Esports NYC App', href: '#' },
  { label: '2024-25 Results', href: '/season' },
  { label: 'Leadership', href: '/leadership' },
  { label: 'Support ESports', href: '#support' },
];

export const SOCIAL_LINKS: SocialLink[] = [
  { platform: 'discord', url: '#', label: 'Discord' },
  { platform: 'instagram', url: '#', label: 'Instagram' },
  { platform: 'twitter', url: '#', label: 'Twitter' },
  { platform: 'facebook', url: '#', label: 'Facebook' },
  { platform: 'youtube', url: '#', label: 'YouTube' },
  { platform: 'twitch', url: '#', label: 'Twitch' },
  { platform: 'messenger', url: '#', label: 'Messenger' },
];

export const FOOTER_LINKS = [
  { label: 'Privacy Policy', href: '#' },
  { label: 'Participant Agreement', href: '#' },
  { label: 'Code of Conduct', href: '#' },
  { label: 'EZ Talk', href: '#' },
  { label: 'Contact', href: '#' },
  { label: 'API Terms', href: '#' },
  { label: 'Press', href: '#' },
  { label: 'FAQs', href: '#' },
] as const;

export const SEASON_INFO = {
  name: 'SPRING SEASON 2025',
  startDate: 'January 27, 2025',
  endDate: 'May 30, 2025',
} as const;


