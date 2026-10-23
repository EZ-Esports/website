import { describe, it, expect } from 'vitest';
import { inactiveSeasonViewOnlyError } from '../season-name';

describe('inactiveSeasonViewOnlyError (spec-028)', () => {
  it('formats the view-only error', () => {
    expect(inactiveSeasonViewOnlyError('2025-26')).toBe('2025-26 is an inactive season and is view-only.');
  });
});
