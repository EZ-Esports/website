import { updateTag } from 'next/cache';

/**
 * Canonical cache tags used across unstable_cache in the application.
 * All mutations in Server Actions should reference these tags when calling updateTag.
 */
export const CACHE_TAGS = {
  GAMES: 'games',
  SCHOOLS: 'schools',
  MEMBERS: 'members',
  TEAMS: 'teams',
  SEASONS: 'seasons',
  MATCHES: 'matches',
  ROSTERS: 'rosters',
  PLAYERS: 'players',
  NEWS: 'news',
  LEADERSHIP: 'leadership',
  PEOPLE: 'people',
  SPONSORS: 'sponsors',
  PAGE_CONTENT: 'page-content',
  GALLERY_IMAGES: 'gallery-images',
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

/**
 * Standard Next.js 16 cache invalidation helper for Server Actions.
 * Calls `updateTag` to immediately expire cache tags and refresh dependent RSCs.
 */
export function updateCacheTags(...tags: (CacheTag | string)[]): void {
  for (const tag of tags) {
    updateTag(tag);
  }
}
