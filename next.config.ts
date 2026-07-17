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
    // Rewrite barrel imports to per-module paths so these packages don't pull
    // their entire (very large) module graph into every route that touches a
    // single export. Big win on admin compile time and client bundle size.
    optimizePackageImports: ['react-icons', 'framer-motion'],
  },
};

export default nextConfig;
