// ============================================================================
// Domain Types
// ============================================================================

export interface Image {
  id?: string;
  src: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface SocialLink {
  platform: 'discord' | 'instagram' | 'twitter' | 'youtube' | 'twitch';
  url: string;
  label: string;
}

export interface NavigationItem {
  label: string;
  href: string;
}

export interface School {
  id: string;
  name: string;
  logoUrl: string;
}

export interface Game {
  id?: string;
  title: string;
  imageUrl: string;
}

export interface VideoItem {
  id?: string;
  videoId: string;
  title: string;
  thumbnailUrl?: string;
  videoUrl?: string;
}

export interface Leader {
  name: string;
  role: string;
  bio?: string;
  image?: string;
}

// ============================================================================
// Common Prop Types
// ============================================================================

export type Theme = 'dark' | 'light';

export type ButtonVariant = 'primary' | 'secondary';

export type ImagePosition = 'left' | 'right';

export type GridColumns = 2 | 3 | 4 | 5;

export interface SectionProps {
  theme?: Theme;
  className?: string;
}

// ============================================================================
// Route/Param Types
// ============================================================================

export interface RouteParams {
  [key: string]: string | string[] | undefined;
}

export interface LeadershipParams extends RouteParams {
  year: string;
}

export interface GameParams extends RouteParams {
  game: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// ============================================================================
// Type Aliases
// ============================================================================

export type Year = string;

// ============================================================================
// Game Types
// ============================================================================

export type GameSlug = 'valorant' | 'league-of-legends' | 'team-fight-tactics';

export interface GameConfig {
  slug: GameSlug;
  displayName: string;
  shortName: string;
  imageUrl: string;
}

export type NavigationState = 'league' | 'game';

export interface NavigationStateResult {
  state: NavigationState;
  game?: GameSlug;
}

export interface GameNavigationItem {
  label: string;
  href: string;
  key: string;
}

// ============================================================================
// Loading Screen Types
// ============================================================================

export interface LoadingScreenProps {
  onComplete?: () => void;
  reducedMotion?: boolean;
}


