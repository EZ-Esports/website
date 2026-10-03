import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/app/(admin)/admin/team/actions', () => ({
  createRole: vi.fn(),
  updateRole: vi.fn(),
  deleteRole: vi.fn(),
  reorderRoles: vi.fn(),
  inviteStaff: vi.fn(),
  revokeInvite: vi.fn(),
  revokeStaff: vi.fn(),
  updateUserRoles: vi.fn(),
}));

import TeamManagerClient from '../TeamManagerClient';

const roles = [
  { id: 'r-owner', name: 'Owner', color: '#f43f5e', permissions: '0', position: 100, isOwner: true, isSystem: true },
  { id: 'r-ops', name: 'League Ops', color: '#3b82f6', permissions: '0', position: 50, isOwner: false, isSystem: false },
];

function render() {
  return renderToStaticMarkup(
    <TeamManagerClient
      current={{ id: 'u1', email: 'owner@example.com', permissions: '0', isOwner: true, highestRolePosition: 100 }}
      staffMembers={[
        {
          userId: 'u2',
          email: 'ops@example.com',
          createdAt: new Date('2026-02-10'),
          roles: [{ id: 'r-ops', name: 'League Ops', color: '#3b82f6', permissions: '0', position: 50, isOwner: false }],
        },
      ]}
      invites={[]}
      roles={roles}
    />,
  );
}

describe('TeamManagerClient tabs', () => {
  it('renders the staff tab and members sub-tab as selected on first render', () => {
    const html = render();

    expect(html).toMatch(/<div[^>]*aria-selected="true"[^>]*>(?:(?!<\/div>)[\s\S])*?Staff members/);
    expect(html).toMatch(/<div[^>]*aria-selected="true"[^>]*>(?:(?!<\/div>)[\s\S])*?Active members/);
    expect(html).toContain('ops@example.com');
  });

  it('keeps inactive panels unmounted, as the conditional rendering did before', () => {
    const html = render();

    // Invites sub-tab body.
    expect(html).not.toContain('Invite a staff member');
    expect(html).not.toContain('name="email"');
    // Roles manager pane and its role editor fields.
    expect(html).not.toContain('Roles are listed in rank hierarchy order');
    expect(html).not.toContain('id="role-name"');
    expect(html).not.toContain('name="perm_');
  });
});
