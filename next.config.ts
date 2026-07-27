import type { NextConfig } from "next";

import path from "path";

import { GAME_SLUGS, getGameDivisionRoute } from "./app/lib/constants";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
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
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'fziqdmlymqtobxrngneh.supabase.co',
      },
    ],
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
