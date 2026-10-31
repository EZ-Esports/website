import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The generic page-content editor needs MANAGE_CONTENT; the onboarding form settings need
 * MANAGE_LEAGUE and validation. Both generic write paths must therefore refuse those rows.
 */

const state = vi.hoisted(() => ({
  current: { content: 'old', key: 'hero.title' } as { content: string; key: string } | undefined,
  history: undefined as { contentKey: string; previousContent: string } | undefined,
  inserts: [] as unknown[],
  updates: [] as unknown[],
}));

vi.mock('../index', () => {
  const selectFrom = (rows: () => unknown[]) => ({
    from: () => ({
      where: () => ({ limit: async () => rows(), then: undefined }),
    }),
  });
  const tx = {
    select: () => selectFrom(() => (state.current ? [state.current] : [])),
    insert: () => ({ values: async (v: unknown) => void state.inserts.push(v) }),
    update: () => ({ set: (v: unknown) => ({ where: async () => void state.updates.push(v) }) }),
  };
  return {
    db: {
      select: () => selectFrom(() => (state.history ? [state.history] : [])),
      transaction: async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
    },
  };
});
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));

import { restorePageContentFromHistory, savePageContentWithHistory } from '../content';
import {
  ONBOARDING_FORM_ENTRY_KEY,
  ONBOARDING_FORM_PAGE_CONTENT_ERROR,
  ONBOARDING_FORM_URL_KEY,
} from '@/app/lib/onboarding/google-form/settings';

beforeEach(() => {
  state.current = { content: 'old', key: 'hero.title' };
  state.history = undefined;
  state.inserts = [];
  state.updates = [];
});

describe('savePageContentWithHistory', () => {
  it('still edits ordinary blocks', async () => {
    await savePageContentWithHistory('id-1', 'new text');
    expect(state.updates).toEqual([{ content: 'new text' }]);
    expect(state.inserts).toHaveLength(1);
  });

  it.each([ONBOARDING_FORM_URL_KEY, ONBOARDING_FORM_ENTRY_KEY])('refuses the %s row and writes nothing', async (key) => {
    state.current = { content: 'https://docs.google.com/x', key };
    await expect(savePageContentWithHistory('id-2', 'https://evil.example')).rejects.toThrow(ONBOARDING_FORM_PAGE_CONTENT_ERROR);
    expect(state.updates).toEqual([]);
    expect(state.inserts).toEqual([]);
  });
});

describe('restorePageContentFromHistory', () => {
  it('still restores ordinary blocks', async () => {
    state.history = { contentKey: 'hero.title', previousContent: 'older' };
    await restorePageContentFromHistory('id-1', 'h1');
    expect(state.updates).toEqual([{ content: 'older' }]);
  });

  it.each([ONBOARDING_FORM_URL_KEY, ONBOARDING_FORM_ENTRY_KEY])('refuses to restore history of the %s row', async (key) => {
    state.history = { contentKey: key, previousContent: 'anything' };
    state.current = { content: 'now', key };
    await expect(restorePageContentFromHistory('id-3', 'h2')).rejects.toThrow(ONBOARDING_FORM_PAGE_CONTENT_ERROR);
    expect(state.updates).toEqual([]);
  });

  it('refuses when the target row is a settings row even if the history entry looks ordinary', async () => {
    state.history = { contentKey: 'hero.title', previousContent: 'older' };
    state.current = { content: 'now', key: ONBOARDING_FORM_URL_KEY };
    await expect(restorePageContentFromHistory('id-4', 'h3')).rejects.toThrow(ONBOARDING_FORM_PAGE_CONTENT_ERROR);
    expect(state.updates).toEqual([]);
  });
});
