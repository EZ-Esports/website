import type { NextConfig } from "next";

import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
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
