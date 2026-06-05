import { type NextRequest } from 'next/server';
import { updateSession } from '@/app/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images/ logos/ icons/ (static assets)
     */
    '/((?!_next/static|_next/image|favicon.ico|images/|logos/|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
