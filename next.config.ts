import type { NextConfig } from "next";

import path from "path";

import { GAME_SLUGS, getGameDivisionRoute } from "./app/lib/constants";

const turbopackRoot = path.resolve(__dirname).includes('.gemini/worktrees')
  ? path.resolve(__dirname, '../../..')
  : path.resolve(__dirname);

const nextConfig: NextConfig = {
  turbopack: {
    root: turbopackRoot,
  },
  /**
   * The bare game URL resolves to that game's Varsity hub.
   *
   * This lives in the config rather than in a `[game]/page.tsx` calling
   * `redirect()`, because the game routes stream: by the time a page component
   * runs, the shell is already on the wire, so Next can only finish the
   * redirect with a `<meta http-equiv="refresh" content="1;...">` — a visible
   * one-second stall on the URL the whole site's navigation points at. Here it
   * is a real 308 with nothing rendered.
   *
   * Sources are enumerated from GAME_SLUGS instead of matched as `/:game`, so
   * an unknown slug still falls through to the 404 it deserves.
   */
  async redirects() {
    return GAME_SLUGS.map((slug) => ({
      source: `/${slug}`,
      destination: getGameDivisionRoute(slug, 'Varsity'),
      permanent: true,
    }));
  },
  images: {
    // Only the gallery lightbox calls /_next/image (thumbnails are `unoptimized`
    // and load straight from Supabase), but every optimized image is billed per
    // distinct (url, width, quality) on Vercel. Few widths and one quality bound
    // that to three transformations per image instead of one per device bucket.
    deviceSizes: [640, 1200, 1920],
    qualities: [75],
    formats: ['image/webp'],
    // 31 days. Uploaded photos already carry a 1-year Cache-Control, which wins
    // when larger; this covers local public/ assets that have none.
    minimumCacheTTL: 2678400,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'fziqdmlymqtobxrngneh.supabase.co',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
  experimental: {
    // Next 16.2.x misclassifies a streaming initial response as a cache restore
    // in Firefox-based browsers, then its dev debug channel calls
    // location.reload() before hydration. This produces an infinite reload
    // loop on async routes such as /valorant. Fixed upstream for Next 16.3:
    // https://github.com/vercel/next.js/pull/94128
    // Remove this override after upgrading to a stable 16.3+ release.
    reactDebugChannel: false,
    // Rewrite barrel imports to per-module paths so these packages don't pull
    // their entire (very large) module graph into every route that touches a
    // single export. Big win on admin compile time and client bundle size.
    optimizePackageImports: ['react-icons', 'framer-motion'],
  },
};

export default nextConfig;
