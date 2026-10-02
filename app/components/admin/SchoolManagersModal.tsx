'use client';

import { useState } from 'react';
import { Overlay, Modal, Dialog, Heading } from '@/app/components/ui/overlay';
import {
  FiUsers,
  FiX,
  FiCheck,
  FiAlertCircle,
  FiUserPlus,
  FiLink,
} from 'react-icons/fi';
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
    <Overlay isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal className="w-full max-w-2xl bg-surface border border-line rounded-2xl shadow-2xl overflow-hidden my-8">
        <Dialog className="flex flex-col max-h-[85vh] outline-none">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-surface-raised/40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent/15 text-accent flex items-center justify-center shrink-0">
                <FiUsers className="w-5 h-5" />
              </div>
              <div>
                <Heading className="text-base font-bold text-foreground">
                  School Managers
                </Heading>
                <p className="text-xs text-foreground-muted">
                  {school.name} &bull; Portal Access Management
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-raised transition-colors"
              aria-label="Close dialog"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-line bg-surface px-6 pt-2 gap-2 text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleTabChange('invites')}
              className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'invites'
                  ? 'border-accent text-accent font-bold'
                  : 'border-transparent text-foreground-muted hover:text-foreground'
              }`}
            >
              <FiLink className="w-3.5 h-3.5" />
              Provision Invite Link
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('active')}
              className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'active'
                  ? 'border-accent text-accent font-bold'
                  : 'border-transparent text-foreground-muted hover:text-foreground'
              }`}
            >
              <FiUsers className="w-3.5 h-3.5" />
              Active Managers ({managers.length})
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('existing')}
              className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'existing'
                  ? 'border-accent text-accent font-bold'
                  : 'border-transparent text-foreground-muted hover:text-foreground'
              }`}
            >
              <FiUserPlus className="w-3.5 h-3.5" />
              Assign Existing Manager
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Status alerts */}
            {fetchError && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-950/20 border border-red-900/40 text-red-300 text-xs">
                <FiAlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{fetchError}</span>
              </div>
            )}

            {formError && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-950/20 border border-red-900/40 text-red-300 text-xs">
                <FiAlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-950/20 border border-emerald-900/40 text-emerald-300 text-xs">
                <FiCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formSuccess}</span>
              </div>
            )}

            {activeTab === 'invites' && (
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
            )}

            {activeTab === 'active' && (
              <ActiveManagersTab
                managers={managers}
                loading={loading}
                isRemovingId={isRemovingId}
                onRemoveManager={handleRemoveManager}
                onError={setFormError}
              />
            )}

            {activeTab === 'existing' && (
              <AssignExistingManagerTab
                school={school}
                games={games}
                registeredManagers={registeredManagers}
                onSwitchToInvites={() => handleTabChange('invites')}
                onRefresh={loadData}
                onError={setFormError}
                onSuccess={setFormSuccess}
              />
            )}
          </div>
        </Dialog>
      </Modal>
    </Overlay>
  );
}
