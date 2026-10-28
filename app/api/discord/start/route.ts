import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { validateInviteToken } from '@/app/lib/onboarding/wizard-actions';
import { buildAuthorizeUrl, DiscordError, getDiscordConfig } from '@/app/lib/onboarding/adapters/discord-rest';
import {
  DISCORD_FLOW_COOKIE,
  DISCORD_FLOW_COOKIE_PATH,
  DISCORD_FLOW_TTL_SECONDS,
  DISCORD_RESULT_COOKIE,
  DISCORD_RESULT_COOKIE_PATH,
  newNonce,
  signFlowCookie,
  signState,
} from '@/app/lib/onboarding/discord-verification';
import { rateLimit, getClientIp } from '@/app/lib/rate-limit';

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,80}$/i;

/** Where the invitee lands after OAuth: the wizard, which resumes at the Discord step. */
function wizardUrl(origin: string, school: string, game: string, token: string, extra: Record<string, string>) {
  const url = new URL(`/join/${encodeURIComponent(school)}/${encodeURIComponent(game)}`, origin);
  url.searchParams.set('token', token);
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  return url;
}

/**
 * Begins Discord OAuth for a player or school manager invite. The raw invite token is kept only in a signed httpOnly
 * cookie; the `state` sent through Discord carries just the invite hash and a nonce.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const token = (searchParams.get('token') || '').trim();
  const school = searchParams.get('school') || '';
  const game = searchParams.get('game') || '';
  // Opened from a second tab: the callback then returns that tab to a "close this tab" page.
  const popup = searchParams.get('popup') === '1';

  if (!token || !SLUG_REGEX.test(school) || !SLUG_REGEX.test(game)) {
    return NextResponse.json({ error: 'Missing or invalid invite parameters.' }, { status: 400 });
  }

  const popupParam: Record<string, string> = popup ? { popup: '1' } : {};

  const rl = rateLimit(`discord-start:${getClientIp(request)}`, 20, 10 * 60_000);
  if (!rl.allowed) {
    return NextResponse.redirect(wizardUrl(origin, school, game, token, { discord_error: 'rate_limited', ...popupParam }), 302);
  }

  const validation = await validateInviteToken({ schoolSlug: school, gameSlug: game, token });
  // Invalid, expired or already used invites are explained by the join page itself.
  // Players and school managers share this flow; a manager invite's join URL uses the `manager` game slug.
  if (!validation.valid) {
    return NextResponse.redirect(wizardUrl(origin, school, game, token, { ...popupParam }), 302);
  }

  let config;
  try {
    config = getDiscordConfig();
  } catch (err) {
    const code = err instanceof DiscordError ? err.code : 'unknown';
    return NextResponse.redirect(wizardUrl(origin, school, game, token, { discord_error: code, ...popupParam }), 302);
  }

  const inviteHash = crypto.createHash('sha256').update(token).digest('hex');
  const nonce = newNonce();
  const redirectUri = new URL('/api/discord/callback', origin).toString();

  const response = NextResponse.redirect(
    buildAuthorizeUrl({
      clientId: config.clientId,
      redirectUri,
      state: signState({ inviteHash, nonce }),
    }),
    302
  );
  response.cookies.set(DISCORD_FLOW_COOKIE, signFlowCookie({ nonce, inviteHash, token, school, game, popup }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: DISCORD_FLOW_COOKIE_PATH,
    maxAge: DISCORD_FLOW_TTL_SECONDS,
  });
  // Reconnecting starts from scratch: drop any earlier verification so a failed attempt cannot leave
  // the old "connected" banner next to the error.
  response.cookies.set(DISCORD_RESULT_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: DISCORD_RESULT_COOKIE_PATH,
    maxAge: 0,
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
