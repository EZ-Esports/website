// ============================================================================
// UI & Component Types
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

export interface VideoItem {
  id?: string;
  videoId: string;
  title: string;
  thumbnailUrl?: string;
  videoUrl?: string;
}

export type Theme = 'dark' | 'light';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline';

export type ButtonSize = 'sm' | 'md';

export type ImagePosition = 'left' | 'right';

export type GridColumns = 2 | 3 | 4 | 5;

export interface SectionProps {
  theme?: Theme;
  className?: string;
}

export interface RouteParams {
  [key: string]: string | string[] | undefined;
}

export interface LeadershipParams extends RouteParams {
  year: string;
}

export interface GameParams extends RouteParams {
  game: string;
}

export type Year = string;

// ============================================================================
// Game Logic Types
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
// Database Entity Types (Aligned with schema.ts)
// ============================================================================

export interface DBGame {
  id: string;
  slug: string;
  displayName: string;
  shortName: string;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBSchool {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  discord: string | null;
  graduationYear: number | null;
  schoolId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBTeam {
  id: string;
  schoolId: string;
  gameId: string;
  seasonId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBRoster {
  id: string;
  teamId: string;
  name: string;
  division: string;
  createdAt: Date;
  updatedAt: Date;
  wins?: number;
  losses?: number;
}

export interface DBPlayer {
  id: string;
  rosterId: string;
  memberId: string;
  role: 'captain' | 'player' | 'coach' | 'sub';
  ign: string | null;
  bio: string | null;
  isCaptain: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBNewsPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  category: string;
  publishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBLeadership {
  id: string;
  memberId: string | null;
  name: string;
  role: string;
  year: string;
  bio: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface School {
  id: string;
  name: string;
  logoUrl: string | null;
}

export interface Game {
  id?: string;
  title: string;
  imageUrl: string;
}

export interface Leader {
  name: string;
  role: string;
  bio?: string;
  image?: string;
}

export interface DBSeason {
  id: string;
  gameId: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Loading Screen Types
// ============================================================================

export interface LoadingScreenProps {
  onComplete?: () => void;
  reducedMotion?: boolean;
}
