import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { validateInviteToken } from '@/app/lib/onboarding/wizard-actions';
import { buildAuthorizeUrl, DiscordError, getDiscordConfig } from '@/app/lib/onboarding/adapters/discord-rest';
import {
  DISCORD_FLOW_COOKIE,
  DISCORD_FLOW_COOKIE_PATH,
  DISCORD_FLOW_TTL_SECONDS,
  newNonce,
  signFlowCookie,
  signState,
} from '@/app/lib/onboarding/discord-verification';
import { rateLimit, getClientIp } from '@/app/lib/rate-limit';

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,80}$/i;

/** Where the student lands after OAuth: the wizard, which resumes at the Discord step. */
function wizardUrl(origin: string, school: string, game: string, token: string, extra: Record<string, string>) {
  const url = new URL(`/join/${encodeURIComponent(school)}/${encodeURIComponent(game)}`, origin);
  url.searchParams.set('token', token);
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  return url;
}

/**
 * Begins Discord OAuth for a player invite. The raw invite token is kept only in a signed httpOnly
 * cookie; the `state` sent through Discord carries just the invite hash and a nonce.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const token = (searchParams.get('token') || '').trim();
  const school = searchParams.get('school') || '';
  const game = searchParams.get('game') || '';

  if (!token || !SLUG_REGEX.test(school) || !SLUG_REGEX.test(game)) {
    return NextResponse.json({ error: 'Missing or invalid invite parameters.' }, { status: 400 });
  }

  const rl = rateLimit(`discord-start:${getClientIp(request)}`, 20, 10 * 60_000);
  if (!rl.allowed) {
    return NextResponse.redirect(wizardUrl(origin, school, game, token, { discord_error: 'rate_limited' }), 302);
  }

  const validation = await validateInviteToken({ schoolSlug: school, gameSlug: game, token });
  // Invalid, expired or already used invites are explained by the join page itself.
  // Managers keep the existing onboarding path; Discord verification is player-only.
  if (!validation.valid || validation.isManager) {
    return NextResponse.redirect(wizardUrl(origin, school, game, token, {}), 302);
  }

  let config;
  try {
    config = getDiscordConfig();
  } catch (err) {
    const code = err instanceof DiscordError ? err.code : 'unknown';
    return NextResponse.redirect(wizardUrl(origin, school, game, token, { discord_error: code }), 302);
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
  response.cookies.set(DISCORD_FLOW_COOKIE, signFlowCookie({ nonce, inviteHash, token, school, game }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: DISCORD_FLOW_COOKIE_PATH,
    maxAge: DISCORD_FLOW_TTL_SECONDS,
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
