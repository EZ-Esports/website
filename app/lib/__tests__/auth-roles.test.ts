import { describe, it, expect } from 'vitest';
import { isSuperAdmin, canActOnRole } from '../roles';

describe('isSuperAdmin', () => {
  it('returns true for super_admin', () => {
    expect(isSuperAdmin('super_admin')).toBe(true);
  });

  it('returns false for admin', () => {
    expect(isSuperAdmin('admin')).toBe(false);
  });
});

describe('canActOnRole', () => {
  it('admin can act on admin', () => {
    expect(canActOnRole('admin', 'admin')).toBe(true);
  });

  it('admin cannot act on super_admin', () => {
    expect(canActOnRole('admin', 'super_admin')).toBe(false);
  });

  it('super_admin can act on admin', () => {
    expect(canActOnRole('super_admin', 'admin')).toBe(true);
  });

  it('super_admin can act on super_admin', () => {
    expect(canActOnRole('super_admin', 'super_admin')).toBe(true);
  });
});
