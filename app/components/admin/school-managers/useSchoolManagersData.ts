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
import type { ManagerItem, ManagerInviteItem } from './types';

export function useSchoolManagersData(schoolId: string, isOpen: boolean) {
  const [managers, setManagers] = useState<ManagerItem[]>([]);
  const [invites, setInvites] = useState<ManagerInviteItem[]>([]);
  const [registeredManagers, setRegisteredManagers] = useState<RegisteredManagerAccount[]>([]);
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

  const handleRemoveManager = async (managerId: string, managerName: string) => {
    if (!confirm(`Are you sure you want to remove manager access for ${managerName}?`)) {
      return { success: false };
    }
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

  const handleRevokeInvite = async (inviteId: string, name: string) => {
    if (!confirm(`Are you sure you want to revoke the invite for ${name}?`)) {
      return { success: false };
    }
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
