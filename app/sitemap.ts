import type { MetadataRoute } from 'next';
import { GAME_SLUGS, getGameRoute, getGameSubRoute } from '@/app/lib/constants';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://ez-esports.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/apply`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/news`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/leadership`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/sponsors`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/archives`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  // Game hubs — derived from GAME_SLUGS so a new game division is covered automatically.
  const gameRoutes: MetadataRoute.Sitemap = GAME_SLUGS.flatMap((slug) => [
    { url: `${BASE_URL}${getGameRoute(slug)}`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.9 },
    { url: `${BASE_URL}${getGameSubRoute(slug, 'schedule')}`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.8 },
    { url: `${BASE_URL}${getGameSubRoute(slug, 'standings')}`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.8 },
    { url: `${BASE_URL}${getGameSubRoute(slug, 'teams')}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.7 },
  ]);

  return [...staticRoutes, ...gameRoutes];
}
