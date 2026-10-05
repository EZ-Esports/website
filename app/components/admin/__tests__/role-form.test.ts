import { describe, it, expect } from 'vitest';
import { buildRoleRequest, seedRoleDraft } from '../role-form';

const role = {
  name: 'League Ops',
  color: '#3b82f6',
  permissions: '12', // bits 4 | 8
  isOwner: false,
  isSystem: false,
};
const ALL_BITS = 0xffn;

describe('seedRoleDraft', () => {
  it('copies the role', () => {
    expect(seedRoleDraft(role)).toEqual({ name: 'League Ops', color: '#3b82f6', permissions: 12n });
  });

  it('starts blank for a new role', () => {
    expect(seedRoleDraft(null)).toEqual({ name: '', color: '#94a3b8', permissions: 0n });
  });
});

describe('buildRoleRequest', () => {
  it('keeps an edited name and the unchanged permissions when saving from the Permissions tab', () => {
    const draft = { ...seedRoleDraft(role), name: 'Ops Lead' };
    expect(buildRoleRequest(draft, role, ALL_BITS)).toEqual({ name: 'Ops Lead', color: '#3b82f6', permissions: '12' });
  });

  it('keeps a toggled permission when saving from the Display tab', () => {
    const draft = { ...seedRoleDraft(role), permissions: 12n | 1n };
    expect(buildRoleRequest(draft, role, ALL_BITS)).toEqual({ name: 'League Ops', color: '#3b82f6', permissions: '13' });
  });

  it('sends only the permission bits the actor may change', () => {
    const draft = { ...seedRoleDraft(role), permissions: 12n | 1n };
    expect(buildRoleRequest(draft, role, 0b1100n).permissions).toBe('12');
  });

  it('sends the Owner role permissions unchanged', () => {
    const owner = { ...role, isOwner: true, isSystem: true, permissions: '255' };
    const draft = { ...seedRoleDraft(owner), permissions: 0n };
    expect(buildRoleRequest(draft, owner, ALL_BITS).permissions).toBe('255');
  });

  it('keeps a system role name locked to its stored name', () => {
    const system = { ...role, isSystem: true };
    const draft = { ...seedRoleDraft(system), name: 'Renamed' };
    expect(buildRoleRequest(draft, system, ALL_BITS).name).toBe('League Ops');
  });

  it('builds a create request from the draft', () => {
    const draft = { name: 'Mod', color: '#ef4444', permissions: 5n };
    expect(buildRoleRequest(draft, null, ALL_BITS)).toEqual({ name: 'Mod', color: '#ef4444', permissions: '5' });
  });
});
