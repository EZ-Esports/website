import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  DiscordError,
  DiscordRestAdapter,
  exchangeCode,
  fetchCurrentUser,
  getDiscordConfig,
  type DiscordFailureCode,
} from '@/app/lib/onboarding/adapters/discord-rest';
import {
  DISCORD_FLOW_COOKIE,
  DISCORD_FLOW_COOKIE_PATH,
  DISCORD_RESULT_COOKIE,
  DISCORD_RESULT_COOKIE_PATH,
  DISCORD_RESULT_TTL_SECONDS,
  hashesEqual,
  signResultCookie,
  verifyFlowCookie,
  verifyState,
} from '@/app/lib/onboarding/discord-verification';

const secure = () => process.env.NODE_ENV === 'production';

function clearFlowCookie(response: NextResponse) {
  response.cookies.set(DISCORD_FLOW_COOKIE, '', {
    httpOnly: true,
    secure: secure(),
    sameSite: 'lax',
    path: DISCORD_FLOW_COOKIE_PATH,
    maxAge: 0,
  });
}

/**
 * Finishes Discord OAuth: verifies state + nonce cookie, exchanges the code, joins the student to
 * the guild with the bot, and records the verified identity in a signed httpOnly cookie.
 * The student's access token lives only in local variables of this request.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const flow = verifyFlowCookie(request.cookies.get(DISCORD_FLOW_COOKIE)?.value);

  // Without the flow cookie we do not know which invite this belongs to (expired, replayed after
  // a successful run, or opened in a different browser), so there is nowhere safe to send them.
  if (!flow) {
    const res = new NextResponse(
      '<!doctype html><meta charset="utf-8"><title>Discord sign-in expired</title><p style="font-family:sans-serif;max-width:32rem;margin:4rem auto">That Discord sign-in expired or was started in a different browser. Please go back to your EZ Esports invite link and press "Connect Discord" again.</p>',
      { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
    );
    clearFlowCookie(res);
    return res;
  }

  const back = (extra: Record<string, string>) => {
    const url = new URL(`/join/${encodeURIComponent(flow.school)}/${encodeURIComponent(flow.game)}`, origin);
    url.searchParams.set('token', flow.tok);
    for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
    const res = NextResponse.redirect(url, 302);
    res.headers.set('Cache-Control', 'no-store');
    // The flow cookie is single-use: any outcome consumes it, which also blocks state replay.
    clearFlowCookie(res);
    return res;
  };
  const fail = (code: DiscordFailureCode) => back({ discord_error: code });

  const state = verifyState(searchParams.get('state'));
  const tokenHash = crypto.createHash('sha256').update(flow.tok).digest('hex');
  if (
    !state ||
    !hashesEqual(state.n, flow.n) ||
    !hashesEqual(state.ih, flow.ih) ||
    !hashesEqual(flow.ih, tokenHash)
  ) {
    return fail('state_invalid');
  }

  if (searchParams.get('error')) return fail('consent_denied');

  const code = searchParams.get('code');
  if (!code) return fail('invalid_code');

  try {
    const config = getDiscordConfig();
    const redirectUri = new URL('/api/discord/callback', origin).toString();

    const { accessToken } = await exchangeCode({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri,
      code,
    });
    const user = await fetchCurrentUser(accessToken);

    const adapter = new DiscordRestAdapter({ botToken: config.botToken, guildId: config.guildId });
    const join = await adapter.addMemberToGuild(user.id, accessToken);

    const res = back({ discord: 'connected' });
    res.cookies.set(
      DISCORD_RESULT_COOKIE,
      signResultCookie({
        discordUserId: user.id,
        discordUsername: user.username,
        inGuild: join.joined || join.alreadyMember,
        inviteHash: flow.ih,
      }),
      {
        httpOnly: true,
        secure: secure(),
        sameSite: 'lax',
        path: DISCORD_RESULT_COOKIE_PATH,
        maxAge: DISCORD_RESULT_TTL_SECONDS,
      }
    );
    return res;
  } catch (err) {
    if (err instanceof DiscordError) return fail(err.code);
    console.error('Unexpected Discord callback failure:', err instanceof Error ? err.message : 'unknown error');
    return fail('unknown');
  }
}
