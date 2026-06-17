import { describe, it, expect } from 'vitest';
import { generateInviteToken, hashInviteToken } from '../invite-token';

describe('hashInviteToken', () => {
  it('returns a 64-char lowercase hex string', () => {
    const hash = hashInviteToken('some-token');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('is deterministic for the same input', () => {
    expect(hashInviteToken('abc')).toBe(hashInviteToken('abc'));
  });

  it('differs for different inputs', () => {
    expect(hashInviteToken('abc')).not.toBe(hashInviteToken('def'));
  });
});

describe('generateInviteToken', () => {
  it('returns a 64-char hex string', () => {
    const token = generateInviteToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it('two calls return different tokens', () => {
    expect(generateInviteToken()).not.toBe(generateInviteToken());
  });
});
