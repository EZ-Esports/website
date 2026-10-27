import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sync: vi.fn(async (_ids: string[]) => ({})),
  after: vi.fn<(fn: () => unknown) => void>(),
}));

vi.mock('../tier-role-sync', () => ({ syncTierRolesForMembers: mocks.sync }));
vi.mock('next/server', () => ({ after: mocks.after }));

import { notifyRosterMembershipChanged } from '../roster-membership-events';

beforeEach(() => {
  mocks.sync.mockReset();
  mocks.sync.mockResolvedValue({});
  mocks.after.mockReset();
  // Default: no request scope, as in a script or test. next's real after() throws there.
  mocks.after.mockImplementation(() => {
    throw new Error('`after` was called outside a request scope');
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('notifyRosterMembershipChanged', () => {
  it('runs the consumer inline with unique ids when there is no request scope', async () => {
    await notifyRosterMembershipChanged(['a', 'b', 'a', 'b', 'c']);
    expect(mocks.sync).toHaveBeenCalledTimes(1);
    expect(mocks.sync).toHaveBeenCalledWith(['a', 'b', 'c']);
  });

  it('does nothing for an empty list', async () => {
    await notifyRosterMembershipChanged([]);
    expect(mocks.sync).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it('defers the consumer with after() inside a request scope, so the click does not wait for Discord', async () => {
    let deferred: (() => unknown) | undefined;
    mocks.after.mockImplementation((fn) => {
      deferred = fn;
    });
    await notifyRosterMembershipChanged(['a', 'a']);
    expect(mocks.sync).not.toHaveBeenCalled();
    await deferred!();
    expect(mocks.sync).toHaveBeenCalledWith(['a']);
  });

  it('never throws when the consumer throws (inline)', async () => {
    mocks.sync.mockRejectedValue(new Error('boom with member data'));
    await expect(notifyRosterMembershipChanged(['a'])).resolves.toBeUndefined();
    expect(JSON.stringify((console.error as unknown as { mock: { calls: unknown[] } }).mock.calls)).not.toContain('member data');
  });

  it('never throws when the deferred consumer throws', async () => {
    let deferred: (() => unknown) | undefined;
    mocks.after.mockImplementation((fn) => {
      deferred = fn;
    });
    mocks.sync.mockRejectedValue(new Error('boom'));
    await notifyRosterMembershipChanged(['a']);
    await expect(Promise.resolve(deferred!())).resolves.toBeUndefined();
  });
});
