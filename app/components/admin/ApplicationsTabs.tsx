'use client';

import type { ReactNode } from 'react';
import { HiOutlineAcademicCap, HiOutlineUserPlus } from 'react-icons/hi2';
import { AdminTab, AdminTabList, AdminTabPanel, AdminTabs } from '@/app/components/admin/AdminTabs';
import { AdminCount } from '@/app/components/admin/AdminUI';

export type ApplicationsTabKey = 'school' | 'staff';

interface ApplicationsTabsProps {
  defaultTab: ApplicationsTabKey;
  /** Undefined when the database is unreachable, so no misleading "0" is shown. */
  schoolCount?: number;
  staffCount?: number;
  /** Server-rendered sections; only the selected one is mounted. */
  school: ReactNode;
  staff: ReactNode;
}

/**
 * Swaps between school and staff applications with the same gliding-underline
 * tabs as Roles & Staff. The tab is mirrored into `?tab=` with
 * `history.replaceState` (no navigation, so nothing refetches) so a refresh or
 * shared link lands on the same tab; each panel's filter links carry their own
 * `tab` value because they are built on the server.
 */
export default function ApplicationsTabs({ defaultTab, schoolCount, staffCount, school, staff }: ApplicationsTabsProps) {
  return (
    <AdminTabs
      defaultSelectedKey={defaultTab}
      onSelectionChange={(key) => {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', String(key));
        window.history.replaceState(window.history.state, '', url);
      }}
    >
      <AdminTabList aria-label="Application types">
        <AdminTab id="school">
          <HiOutlineAcademicCap aria-hidden className="h-4 w-4" />
          School applications
          {schoolCount !== undefined && <AdminCount>{schoolCount}</AdminCount>}
        </AdminTab>
        <AdminTab id="staff">
          <HiOutlineUserPlus aria-hidden className="h-4 w-4" />
          Staff applications
          {staffCount !== undefined && <AdminCount>{staffCount}</AdminCount>}
        </AdminTab>
      </AdminTabList>

      <AdminTabPanel id="school">{school}</AdminTabPanel>
      <AdminTabPanel id="staff">{staff}</AdminTabPanel>
    </AdminTabs>
  );
}
