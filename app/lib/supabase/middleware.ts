import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export function buildCsp(nonce: string): string {
  return [
    "default-src 'self';",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline';`,
    "style-src 'self' 'unsafe-inline';",
    "img-src 'self' data: blob: https://*.supabase.co https://*.ytimg.com https://*.youtube.com;",
    "font-src 'self' data:;",
    "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com https://player.twitch.tv;",
    "connect-src 'self' https://*.supabase.co https://va.vercel-scripts.com https://vitals.vercel-insights.com;",
    "object-src 'none';",
    "base-uri 'self';",
    "form-action 'self';",
    "frame-ancestors 'none';",
  ].join(' ');
}

export const generateCsp = buildCsp;
export const createCsp = buildCsp;

export async function updateSession(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  request.headers.set('x-nonce', nonce);
  const csp = buildCsp(nonce);
  request.headers.set('Content-Security-Policy', csp);

  let supabaseResponse = NextResponse.next({
    request,
  });
  supabaseResponse.headers.set('Content-Security-Policy', csp);

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith('/admin') || pathname.startsWith('/login');

  if (!isAuthRoute) {
    return supabaseResponse;
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          supabaseResponse.headers.set('Content-Security-Policy', csp);
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired and retrieve authenticated user.
  // getClaims() verifies the JWT locally when signing keys are enabled, avoiding
  // a blocking call to the Supabase Auth API on every /admin and /login request.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  // The /admin server layout is the sole portal access gate. Middleware only
  // refreshes auth state and keeps authenticated staff off the login form.
  if (request.nextUrl.pathname.startsWith('/login')) {
    if (user) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
