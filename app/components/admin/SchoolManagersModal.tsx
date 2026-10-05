'use client';

import { useState } from 'react';
import { Overlay, Modal, Dialog, Heading } from '@/app/components/ui/overlay';
import {
  FiUsers,
  FiX,
  FiUserPlus,
  FiLink,
} from 'react-icons/fi';
import { AdminTab, AdminTabList, AdminTabPanel, AdminTabs } from './AdminTabs';
import { AdminNotice } from './AdminUI';
import { iconBtn } from './styles';
import type { SchoolManagersModalProps } from './school-managers/types';
import { useSchoolManagersData } from './school-managers/useSchoolManagersData';
import { ProvisionInviteTab } from './school-managers/ProvisionInviteTab';
import { ActiveManagersTab } from './school-managers/ActiveManagersTab';
import { AssignExistingManagerTab } from './school-managers/AssignExistingManagerTab';

export default function SchoolManagersModal({
  school,
  games = [],
  isOpen,
  onOpenChange,
}: SchoolManagersModalProps) {
  const [activeTab, setActiveTab] = useState<'invites' | 'active' | 'existing'>('invites');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const {
    managers,
    invites,
    registeredManagers,
    loading,
    fetchError,
    loadData,
    isRemovingId,
    isRevokingId,
    handleRemoveManager,
    handleRevokeInvite,
  } = useSchoolManagersData(school.id, isOpen);

  const handleTabChange = (tab: 'invites' | 'active' | 'existing') => {
    setActiveTab(tab);
    setFormError(null);
    setFormSuccess(null);
  };

  return (
    <Overlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className="admin-modal-overlay fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4"
    >
      <Modal className="admin-modal my-8 w-full max-w-2xl overflow-hidden rounded-2xl bg-surface-raised text-left shadow-2xl shadow-black/60 ring-1 ring-line/70 outline-none">
        <Dialog className="flex max-h-[85vh] flex-col outline-none">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-line/60 px-6 pt-5 pb-0">
            <div className="flex items-center gap-3">
              <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <FiUsers className="h-5 w-5" />
              </span>
              <div>
                <Heading className="text-lg font-semibold text-foreground">School managers</Heading>
                <p className="text-sm text-foreground-secondary">{school.name} · Portal access management</p>
              </div>
            </div>
            <button type="button" onClick={() => onOpenChange(false)} className={`${iconBtn} -mr-2 -mt-1`} aria-label="Close dialog">
              <FiX aria-hidden className="h-5 w-5" />
            </button>
          </div>

          <AdminTabs
            selectedKey={activeTab}
            onSelectionChange={(key) => handleTabChange(key as 'invites' | 'active' | 'existing')}
            className="flex min-h-0 flex-1 flex-col space-y-0"
          >
            {/* Navigation Tabs */}
            <div className="px-6 pt-3">
              <AdminTabList aria-label="School manager tools">
                <AdminTab id="invites">
                  <FiLink aria-hidden className="h-3.5 w-3.5" />
                  Provision invite link
                </AdminTab>
                <AdminTab id="active">
                  <FiUsers aria-hidden className="h-3.5 w-3.5" />
                  Active managers <span className="tabular-nums text-foreground-secondary">{managers.length}</span>
                </AdminTab>
                <AdminTab id="existing">
                  <FiUserPlus aria-hidden className="h-3.5 w-3.5" />
                  Assign existing manager
                </AdminTab>
              </AdminTabList>
            </div>

            {/* Body */}
            <div className="flex-1 space-y-6 overflow-y-auto p-6">
              {/* Status alerts */}
              {fetchError && <AdminNotice tone="danger">{fetchError}</AdminNotice>}
              {formError && <AdminNotice tone="danger">{formError}</AdminNotice>}
              {formSuccess && <AdminNotice tone="success">{formSuccess}</AdminNotice>}

              <AdminTabPanel id="invites">
                <ProvisionInviteTab
                  schoolId={school.id}
                  games={games}
                  invites={invites}
                  isRevokingId={isRevokingId}
                  onRevokeInvite={handleRevokeInvite}
                  onRefresh={loadData}
                  onError={setFormError}
                  onSuccess={setFormSuccess}
                />
              </AdminTabPanel>

              <AdminTabPanel id="active">
                <ActiveManagersTab
                  managers={managers}
                  loading={loading}
                  isRemovingId={isRemovingId}
                  onRemoveManager={handleRemoveManager}
                  onError={setFormError}
                />
              </AdminTabPanel>

              <AdminTabPanel id="existing">
                <AssignExistingManagerTab
                  school={school}
                  games={games}
                  registeredManagers={registeredManagers}
                  onSwitchToInvites={() => handleTabChange('invites')}
                  onRefresh={loadData}
                  onError={setFormError}
                  onSuccess={setFormSuccess}
                />
              </AdminTabPanel>
            </div>
          </AdminTabs>
        </Dialog>
      </Modal>
    </Overlay>
  );
}
