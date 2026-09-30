import { describe, expect, it } from 'vitest';
import { actionSuccess, actionError } from '@/app/lib/result';
import { isValidStatusTransition, APPLICATION_STATUS_TRANSITIONS } from '@/app/lib/application-status';

describe('Admin Mutation Result Contract & Application Status Machine', () => {
  describe('ActionResult Discriminated Union Contract', () => {
    it('returns success object with data when actionSuccess is called with value', () => {
      const res = actionSuccess({ id: '123' });
      expect(res).toEqual({ success: true, data: { id: '123' } });
      if (res.success) {
        expect(res.data).toEqual({ id: '123' });
      }
    });

    it('returns success object without data when actionSuccess is called with void', () => {
      const res = actionSuccess();
      expect(res).toEqual({ success: true });
      expect(res.success).toBe(true);
    });

    it('returns error object when actionError is called', () => {
      const res = actionError('Database operation failed');
      expect(res).toEqual({ success: false, error: 'Database operation failed' });
      if (!res.success) {
        expect(res.error).toBe('Database operation failed');
      }
    });
  });

  describe('Application Status State Machine', () => {
    it('allows pending to transition to reviewed, accepted, or rejected', () => {
      expect(isValidStatusTransition('pending', 'reviewed')).toBe(true);
      expect(isValidStatusTransition('pending', 'accepted')).toBe(true);
      expect(isValidStatusTransition('pending', 'rejected')).toBe(true);
      expect(isValidStatusTransition('pending', 'pending')).toBe(false);
    });

    it('allows reviewed to transition to accepted or rejected, but not back to pending', () => {
      expect(isValidStatusTransition('reviewed', 'accepted')).toBe(true);
      expect(isValidStatusTransition('reviewed', 'rejected')).toBe(true);
      expect(isValidStatusTransition('reviewed', 'pending')).toBe(false);
    });

    it('allows accepted to transition to rejected or reviewed, but not pending', () => {
      expect(isValidStatusTransition('accepted', 'rejected')).toBe(true);
      expect(isValidStatusTransition('accepted', 'reviewed')).toBe(true);
      expect(isValidStatusTransition('accepted', 'pending')).toBe(false);
    });

    it('allows rejected to transition to accepted or reviewed, but not pending', () => {
      expect(isValidStatusTransition('rejected', 'accepted')).toBe(true);
      expect(isValidStatusTransition('rejected', 'reviewed')).toBe(true);
      expect(isValidStatusTransition('rejected', 'pending')).toBe(false);
    });

    it('defines transition table explicitly', () => {
      expect(APPLICATION_STATUS_TRANSITIONS).toEqual({
        pending: ['reviewed', 'accepted', 'rejected'],
        reviewed: ['accepted', 'rejected'],
        accepted: ['rejected', 'reviewed'],
        rejected: ['accepted', 'reviewed'],
      });
    });
  });

  describe('Pending Lock & Action Error Contracts', () => {
    it('prevents double-firing when action is pending', async () => {
      let callCount = 0;
      let isPending = false;

      const triggerAction = async () => {
        if (isPending) return;
        isPending = true;
        callCount++;
        await new Promise((r) => setTimeout(r, 10));
        isPending = false;
      };

      const first = triggerAction();
      const second = triggerAction();
      await Promise.all([first, second]);

      expect(callCount).toBe(1);
    });

    it('returns error result when mutation failure occurs without masking symptoms', async () => {
      const failingMutation = async () => actionError('Permission denied');
      const res = await failingMutation();

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('Permission denied');
      }
    });
  });
});

