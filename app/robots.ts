import type { MetadataRoute } from 'next';
import { CANONICAL_APP_URL } from '@/app/lib/constants';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/'],
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_APP_URL || CANONICAL_APP_URL}/sitemap.xml`,
  };
}
