import type { NavigationItem, SocialLink, Theme, GameSlug, GameConfig, NavigationStateResult } from '@/app/types';

// ============================================================================
// Site Configuration
// ============================================================================

export const SITE_CONFIG = {
  name: 'NYC High School Esports League',
  company: 'EZ Esports',
  description: 'Shaping the leaders of tomorrow through their passion for esports today.',
} as const;

// ============================================================================
// Route Constants
// ============================================================================

export const ROUTES = {
  home: '/',
  about: '/about',
  news: '/news',
  leadership: '/leadership',
  archives: '/archives',
  support: '#support',
} as const;

export const getLeadershipRoute = (year: string): string => `${ROUTES.leadership}/${year}`;

// ============================================================================
// Game Constants
// ============================================================================

export const GAMES: Record<GameSlug, GameConfig> = {
  valorant: {
    slug: 'valorant',
    displayName: 'Valorant',
    shortName: 'Valorant',
    imageUrl: '/images/games/val-banner.png',
  },
  'league-of-legends': {
    slug: 'league-of-legends',
    displayName: 'League of Legends',
    shortName: 'League',
    imageUrl: '/images/games/lol-banner.png',
  },
  'team-fight-tactics': {
    slug: 'team-fight-tactics',
    displayName: 'Team fight tactics',
    shortName: 'TFT',
    imageUrl: '/images/games/tft-banner.png',
  },
} as const;

export const GAME_SLUGS: GameSlug[] = ['valorant', 'league-of-legends', 'team-fight-tactics'];

// ============================================================================
// Game Route Helpers
// ============================================================================

export const getGameRoute = (gameSlug: GameSlug): string => `/${gameSlug}`;

export const getGameSubRoute = (gameSlug: GameSlug, subRoute: 'schedule' | 'standings' | 'teams' | 'roster'): string => {
  return `/${gameSlug}/${subRoute}`;
};

export const isGameRoute = (pathname: string): boolean => {
  return GAME_SLUGS.some((slug) => pathname.startsWith(`/${slug}`));
};

export const getGameFromPath = (pathname: string): GameSlug | null => {
  for (const slug of GAME_SLUGS) {
    if (pathname.startsWith(`/${slug}`)) {
      return slug;
    }
  }
  return null;
};

export const getNavigationState = (pathname: string): NavigationStateResult => {
  const game = getGameFromPath(pathname);
  if (game) {
    return { state: 'game', game };
  }
  return { state: 'league' };
};

// ============================================================================
// Theme Constants
// ============================================================================

export const THEMES: Record<Theme, Theme> = {
  dark: 'dark',
  light: 'light',
} as const;

export const THEME_CLASSES: Record<Theme, { bg: string; text: string }> = {
  dark: {
    bg: 'bg-gray-900',
    text: 'text-white',
  },
  light: {
    bg: 'bg-rose-50',
    text: 'text-gray-900',
  },
} as const;

// ============================================================================
// API/URL Constants
// ============================================================================

export const YOUTUBE_EMBED_BASE_URL = 'https://www.youtube.com/embed';

export const EXTERNAL_LINKS = {
  twitch: 'https://www.twitch.tv',
  youtube: 'https://www.youtube.com',
} as const;

// ============================================================================
// Social Icon Constants
// ============================================================================

export const SOCIAL_ICON_INITIALS: Record<string, string> = {
  discord: 'D',
  instagram: 'I',
  twitter: 'T',
  facebook: 'F',
  youtube: 'Y',
  twitch: 'Tw',
  messenger: 'M',
} as const;

// ============================================================================
// Navigation
// ============================================================================

export const NAV_ITEMS: NavigationItem[] = [
  { label: 'Leadership', href: ROUTES.leadership },
  { label: 'Support ESports', href: ROUTES.support },
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

// ============================================================================
// Component-Specific Constants
// ============================================================================

export const GRID_COLUMNS: Record<2 | 3 | 4 | 5, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 md:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-4',
  5: 'grid-cols-2 md:grid-cols-5',
} as const;

export const BUTTON_VARIANTS = {
  primary: 'primary',
  secondary: 'secondary',
} as const;

// ============================================================================
// Metadata Constants
// ============================================================================

export const METADATA = {
  defaultTitle: SITE_CONFIG.name,
  defaultDescription: SITE_CONFIG.description,
  siteName: SITE_CONFIG.name,
} as const;


