'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getSchoolManagers,
  getSchoolManagerInvites,
  getRegisteredManagers,
  removeSchoolManager,
  revokeManagerInvite,
  type RegisteredManagerAccount,
} from '@/app/(admin)/admin/schools/manager-actions';
import { getManagerContentFlags } from '@/app/(admin)/admin/schools/content-flag-actions';
import type { ContentFlagView } from '@/app/lib/db/content-flags';
import type { ManagerItem, ManagerInviteItem } from './types';

export function useSchoolManagersData(schoolId: string, isOpen: boolean) {
  const [managers, setManagers] = useState<ManagerItem[]>([]);
  const [invites, setInvites] = useState<ManagerInviteItem[]>([]);
  const [registeredManagers, setRegisteredManagers] = useState<RegisteredManagerAccount[]>([]);
  const [contentFlags, setContentFlags] = useState<Record<string, ContentFlagView[]>>({});
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isRemovingId, setIsRemovingId] = useState<string | null>(null);
  const [isRevokingId, setIsRevokingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    setFetchError(null);
    try {
      const [mgrs, invs, regMgrs] = await Promise.all([
        getSchoolManagers(schoolId),
        getSchoolManagerInvites(schoolId),
        getRegisteredManagers(),
      ]);
      setManagers(mgrs);
      setInvites(invs);
      setRegisteredManagers(regMgrs);
      // Badges are optional extras: a failure here must never hide the managers themselves.
      try {
        const memberIds = mgrs.map((m: ManagerItem) => m.memberId).filter((id: string | null | undefined): id is string => Boolean(id));
        setContentFlags(memberIds.length > 0 ? await getManagerContentFlags(memberIds) : {});
      } catch {
        setContentFlags({});
      }
    } catch (err: any) {
      setFetchError(err.message || 'Failed to load school manager records.');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  // Callers confirm first (ConfirmActionDialog); these run the action unconditionally.
  const handleRemoveManager = async (managerId: string) => {
    setIsRemovingId(managerId);
    try {
      const res = await removeSchoolManager({ managerId });
      if (!res.success) {
        return { success: false, error: res.error || 'Failed to remove manager.' };
      }
      await loadData();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to remove manager.' };
    } finally {
      setIsRemovingId(null);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    setIsRevokingId(inviteId);
    try {
      const res = await revokeManagerInvite(inviteId);
      if (!res.success) {
        return { success: false, error: res.error || 'Failed to revoke invite.' };
      }
      await loadData();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to revoke invite.' };
    } finally {
      setIsRevokingId(null);
    }
  };

  return {
    managers,
    contentFlags,
    invites,
    registeredManagers,
    loading,
    fetchError,
    setFetchError,
    loadData,
    isRemovingId,
    isRevokingId,
    handleRemoveManager,
    handleRevokeInvite,
  };
}
