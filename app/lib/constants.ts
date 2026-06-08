import type { NavigationItem, SocialLink, Theme, GameSlug, GameConfig, NavigationStateResult, Game } from '@/app/types';

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
// Game Data Helpers
// ============================================================================

// Map game slugs to short IDs for GameShowcase component
const gameSlugToId: Record<GameSlug, string> = {
  'league-of-legends': 'lol',
  'valorant': 'val',
  'team-fight-tactics': 'tft',
} as const;

/**
 * Converts GAMES constant to Game[] format for use in GameShowcase component
 */
export const getGamesForShowcase = (): Game[] => {
  return GAME_SLUGS.map((slug) => {
    const gameConfig = GAMES[slug];
    return {
      id: gameSlugToId[slug],
      title: gameConfig.displayName,
      imageUrl: gameConfig.imageUrl,
    };
  });
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
    bg: 'bg-background',
    text: 'text-foreground',
  },
  light: {
    bg: 'bg-background-secondary border-y border-custom-border/30',
    text: 'text-foreground',
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
// Navigation
// ============================================================================

export const NAV_ITEMS: NavigationItem[] = [
  { label: 'Leadership', href: ROUTES.leadership },
  { label: 'Support ESports', href: ROUTES.support },
];

export const SOCIAL_LINKS: SocialLink[] = [
  { platform: 'discord', url: 'https://discord.com/invite/RajSZqNyvu', label: 'Discord' },
  { platform: 'instagram', url: 'https://www.instagram.com/e.z.esports/', label: 'Instagram' },
  { platform: 'twitter', url: 'https://x.com/ezesportsleague', label: 'Twitter' },
  { platform: 'youtube', url: 'https://www.youtube.com/channel/UCs6cNSviggm11aZwfV8XrAg', label: 'YouTube' },
  { platform: 'twitch', url: 'https://www.twitch.tv/ezesportsNYC', label: 'Twitch' },
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
  { label: 'Staff Login', href: '/login' },
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

// ============================================================================
// Loading Screen Constants
// ============================================================================

export const LOADING_SCREEN_TIMINGS = {
  showLogo: 800,
  barsExtend: 800,
  cleanup: 400,
} as const;

export const LOADING_SCREEN_ANIMATIONS = {
  barsExtend: {
    duration: 0.6,
    ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
  },
  overlayFade: {
    duration: 0.3,
  },
} as const;