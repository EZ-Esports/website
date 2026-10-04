import { describe, it, expect } from 'vitest';
import { selectClass, selectClassCompact } from '../styles';

const chevronTokens = (cls: string) =>
  cls.split(' ').filter((c) => c.startsWith('pl-') || c.startsWith('[--select-chevron'));

describe('select class variants', () => {
  it('selectClass uses the default chevron inset and padding', () => {
    expect(chevronTokens(selectClass)).toEqual([
      'pl-3',
      '[--select-chevron-inset:0.75rem]',
      '[--select-chevron-space:2.25rem]',
    ]);
    expect(selectClass).toContain('h-8');
  });

  it('selectClassCompact uses the compact chevron inset and padding', () => {
    expect(chevronTokens(selectClassCompact)).toEqual([
      'pl-2.5',
      '[--select-chevron-inset:0.625rem]',
      '[--select-chevron-space:2rem]',
    ]);
    expect(selectClassCompact).toContain('h-8');
  });
});
