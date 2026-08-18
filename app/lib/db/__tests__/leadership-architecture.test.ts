import { describe, it, expect } from 'vitest';
import * as schema from '../schema';
import { classifyRole } from '@/db/backfill-leadership';

describe('Leadership Architecture & Schema Normalization', () => {
  describe('Schema Definitions', () => {
    it('defines people table with required columns', () => {
      expect(schema.people).toBeDefined();
      expect(schema.people.id).toBeDefined();
      expect(schema.people.fullName).toBeDefined();
      expect(schema.people.handle).toBeDefined();
      expect(schema.people.avatarUrl).toBeDefined();
      expect(schema.people.storageKey).toBeDefined();
      expect(schema.people.highSchool).toBeDefined();
      expect(schema.people.university).toBeDefined();
      expect(schema.people.graduationYear).toBeDefined();
      expect(schema.people.bio).toBeDefined();
      expect(schema.people.isActive).toBeDefined();
    });

    it('defines leadership_terms table with required foreign key relation', () => {
      expect(schema.leadershipTerms).toBeDefined();
      expect(schema.leadershipTerms.id).toBeDefined();
      expect(schema.leadershipTerms.personId).toBeDefined();
      expect(schema.leadershipTerms.year).toBeDefined();
      expect(schema.leadershipTerms.role).toBeDefined();
      expect(schema.leadershipTerms.department).toBeDefined();
      expect(schema.leadershipTerms.displayOrder).toBeDefined();
      expect(schema.leadershipTerms.termBio).toBeDefined();
    });

    it('preserves legacy leadership table for backwards compatibility', () => {
      expect(schema.leadership).toBeDefined();
      expect(schema.leadership.name).toBeDefined();
      expect(schema.leadership.role).toBeDefined();
      expect(schema.leadership.year).toBeDefined();
    });
  });

  describe('classifyRole Seniority & Department Normalization', () => {
    it('classifies Executive tier (order 1)', () => {
      expect(classifyRole('President')).toEqual({ displayOrder: 1, department: 'Executive' });
      expect(classifyRole('Founder')).toEqual({ displayOrder: 1, department: 'Executive' });
      expect(classifyRole('CTO')).toEqual({ displayOrder: 1, department: 'Executive' });
      expect(classifyRole('Vice President')).toEqual({ displayOrder: 1, department: 'Executive' });
    });

    it('classifies Director tier (order 2)', () => {
      expect(classifyRole('Broadcasting Director')).toEqual({ displayOrder: 2, department: 'Broadcasting' });
      expect(classifyRole('Marketing Director')).toEqual({ displayOrder: 2, department: 'Marketing' });
      expect(classifyRole('VALORANT Director')).toEqual({ displayOrder: 2, department: 'VALORANT' });
      expect(classifyRole('Director')).toEqual({ displayOrder: 2, department: 'Directors' });
    });

    it('classifies Associate / Staff tier (order 3)', () => {
      expect(classifyRole('Broadcasting Associate')).toEqual({ displayOrder: 3, department: 'Broadcasting' });
      expect(classifyRole('Engineering Associate')).toEqual({ displayOrder: 3, department: 'Engineering' });
      expect(classifyRole('Software Engineer')).toEqual({ displayOrder: 3, department: 'Staff' });
    });

    it('classifies Advisor / Special Thanks tier (order 4)', () => {
      expect(classifyRole('Advisor')).toEqual({ displayOrder: 4, department: 'Advisors' });
      expect(classifyRole('VALORANT Advisor')).toEqual({ displayOrder: 4, department: 'Advisors' });
      expect(classifyRole('Special Thanks')).toEqual({ displayOrder: 4, department: 'Advisors' });
      expect(classifyRole('Apparel & Art Special Thanks')).toEqual({ displayOrder: 4, department: 'Advisors' });
    });
  });
});
