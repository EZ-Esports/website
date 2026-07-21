import type { NavigationItem, SocialLink, GameSlug, GameConfig, NavigationStateResult, Game } from '@/app/types';

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
  apply: '/apply',
  sponsors: '/sponsors',
  privacy: '/privacy',
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
    displayName: 'Teamfight Tactics',
    shortName: 'Teamfight Tactics',
    imageUrl: '/images/games/tft-banner.png',
  },
} as const;

export const GAME_SLUGS: GameSlug[] = ['valorant', 'team-fight-tactics', 'league-of-legends'];

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
  { label: 'Support Esports', href: ROUTES.sponsors },
];

export const SOCIAL_LINKS: SocialLink[] = [
  { platform: 'discord', url: 'https://discord.com/invite/RajSZqNyvu', label: 'Discord' },
  { platform: 'instagram', url: 'https://www.instagram.com/e.z.esports/', label: 'Instagram' },
  { platform: 'twitter', url: 'https://x.com/ezesportsleague', label: 'Twitter' },
  { platform: 'youtube', url: 'https://www.youtube.com/channel/UCs6cNSviggm11aZwfV8XrAg', label: 'YouTube' },
  { platform: 'twitch', url: 'https://www.twitch.tv/ezesportsNYC', label: 'Twitch' },
];

export const FOOTER_LINKS = [
  { label: 'Apply', href: '/apply' },
  { label: 'News', href: '/news' },
  { label: 'Leadership', href: '/leadership' },
  { label: 'Sponsors', href: '/sponsors' },
  { label: 'About', href: '/about' },
  { label: 'Archives', href: '/archives' },
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Staff Login', href: '/login' },
] as const;

// ============================================================================
// Component-Specific Constants
// ============================================================================

// Per-item width classes for a centered flex-wrap gallery (gap-6 = 1.5rem).
// Width = (100% - (cols-1) * gap) / cols, so full rows fill edge-to-edge and any
// partial last row stays centered instead of left-aligned. Mobile is always 2-up.
export const GALLERY_ITEM_WIDTHS: Record<2 | 3 | 4 | 5, string> = {
  2: 'w-[calc(50%_-_0.75rem)]',
  3: 'w-[calc(50%_-_0.75rem)] md:w-[calc(33.333%_-_1rem)]',
  4: 'w-[calc(50%_-_0.75rem)] md:w-[calc(25%_-_1.125rem)]',
  5: 'w-[calc(50%_-_0.75rem)] md:w-[calc(20%_-_1.2rem)]',
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