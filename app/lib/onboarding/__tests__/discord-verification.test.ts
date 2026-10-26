import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  signFlowCookie,
  signResultCookie,
  signState,
  verifyFlowCookie,
  verifyResultCookie,
  verifyState,
  DISCORD_RESULT_TTL_SECONDS,
  DISCORD_FLOW_TTL_SECONDS,
} from '../discord-verification';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const UID = '123456789012345678';
const NOW = 1_800_000_000;
const TEST_SECRET = 'test-secret-not-real';

let previous: string | undefined;
beforeAll(() => {
  previous = process.env.DISCORD_CLIENT_SECRET;
  process.env.DISCORD_CLIENT_SECRET = TEST_SECRET;
});
afterAll(() => {
  if (previous === undefined) delete process.env.DISCORD_CLIENT_SECRET;
  else process.env.DISCORD_CLIENT_SECRET = previous;
});

/** Rewrites the payload but keeps the original MAC, as a forger without the key would. */
function tamper(value: string) {
  const [body, mac] = value.split('.');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  payload.ih = HASH_B;
  return `${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${mac}`;
}

describe('state', () => {
  it('round-trips', () => {
    const v = verifyState(signState({ inviteHash: HASH_A, nonce: 'n1' }, NOW), NOW + 5);
    expect(v).toMatchObject({ ih: HASH_A, n: 'n1' });
  });

  it('rejects forged payloads, garbage and expiry', () => {
    const signed = signState({ inviteHash: HASH_A, nonce: 'n1' }, NOW);
    expect(verifyState(tamper(signed), NOW)).toBeNull();
    expect(verifyState('garbage', NOW)).toBeNull();
    expect(verifyState(undefined, NOW)).toBeNull();
    expect(verifyState(signed, NOW + DISCORD_FLOW_TTL_SECONDS + 1)).toBeNull();
  });

  it('is rejected under a different secret', () => {
    const signed = signState({ inviteHash: HASH_A, nonce: 'n1' }, NOW);
    process.env.DISCORD_CLIENT_SECRET = 'another-secret';
    expect(verifyState(signed, NOW)).toBeNull();
    process.env.DISCORD_CLIENT_SECRET = TEST_SECRET;
  });

  it('kinds are not interchangeable', () => {
    const flow = signFlowCookie({ nonce: 'n', inviteHash: HASH_A, token: 't', school: 's', game: 'g' }, NOW);
    expect(verifyState(flow, NOW)).toBeNull();
    const result = signResultCookie(
      { discordUserId: UID, discordUsername: 'a', inGuild: true, inviteHash: HASH_A },
      NOW
    );
    expect(verifyFlowCookie(result, NOW)).toBeNull();
    expect(verifyResultCookie(flow, HASH_A, NOW)).toBeNull();
  });
});

describe('result cookie', () => {
  const sign = (over: Partial<Parameters<typeof signResultCookie>[0]> = {}) =>
    signResultCookie(
      { discordUserId: UID, discordUsername: 'alex', inGuild: true, inviteHash: HASH_A, ...over },
      NOW
    );

  it('verifies for the matching invite', () => {
    expect(verifyResultCookie(sign(), HASH_A, NOW + 1)).toEqual({
      discordUserId: UID,
      discordUsername: 'alex',
      inGuild: true,
      inviteHash: HASH_A,
    });
  });

  it('rejects a different invite hash', () => {
    expect(verifyResultCookie(sign(), HASH_B, NOW)).toBeNull();
  });

  it('rejects a forged cookie', () => {
    expect(verifyResultCookie(tamper(sign()), HASH_B, NOW)).toBeNull();
  });

  it('rejects an expired cookie', () => {
    expect(verifyResultCookie(sign(), HASH_A, NOW + DISCORD_RESULT_TTL_SECONDS + 1)).toBeNull();
  });

  it('rejects a malformed snowflake even if correctly signed', () => {
    expect(verifyResultCookie(sign({ discordUserId: 'alex#1234' }), HASH_A, NOW)).toBeNull();
  });
});
