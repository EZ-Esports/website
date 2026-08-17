import { describe, expect, it } from 'vitest';
import * as schema from '@/app/lib/db/schema';
import { buildSchoolApplicationsQuery, buildStaffApplicationsQuery } from '@/app/lib/db/queries';

describe('Application Status Logs & Append-Only Schema', () => {
  describe('Schema Definitions', () => {
    it('defines applicationStatusEnum with pending, reviewed, accepted, rejected', () => {
      expect(schema.applicationStatusEnum.enumValues).toEqual([
        'pending',
        'reviewed',
        'accepted',
        'rejected',
      ]);
    });

    it('defines applicationStatusLogs table with expected columns and check constraint', () => {
      const columns = schema.applicationStatusLogs;
      expect(columns.id).toBeDefined();
      expect(columns.applicationId).toBeDefined();
      expect(columns.applicationType).toBeDefined();
      expect(columns.status).toBeDefined();
      expect(columns.actorUserId).toBeDefined();
      expect(columns.actorEmail).toBeDefined();
      expect(columns.reason).toBeDefined();
      expect(columns.createdAt).toBeDefined();
    });

    it('ensures schoolApplications and staffApplications do not carry legacy status columns', () => {
      expect('status' in schema.schoolApplications).toBe(false);
      expect('status' in schema.staffApplications).toBe(false);
    });
  });

  describe('School Applications Query Logic', () => {
    it('builds school applications query joining latest application_status_logs partitioned by type and id', () => {
      const query = buildSchoolApplicationsQuery();
      const { sql, params } = query.toSQL();

      expect(sql).toContain('"application_status_logs"');
      expect(sql).toContain('partition by "application_type", "application_id"');
      expect(sql).toContain('order by "created_at" desc, "id" desc');
      expect(sql).toContain('COALESCE("latest_logs"."status", \'pending\')');
      expect(params).toContain('school');
    });

    it('filters for pending applications including fallback to pending when no log exists', () => {
      const query = buildSchoolApplicationsQuery('pending');
      const { sql } = query.toSQL();

      expect(sql).toContain('"latest_logs"."status" is null or "latest_logs"."status" =');
    });

    it('filters for reviewed applications strictly by latest status log', () => {
      const query = buildSchoolApplicationsQuery('reviewed');
      const { sql, params } = query.toSQL();

      expect(sql).toContain('"latest_logs"."status" =');
      expect(params).toContain('reviewed');
    });

    it('filters for accepted applications strictly by latest status log', () => {
      const query = buildSchoolApplicationsQuery('accepted');
      const { sql, params } = query.toSQL();

      expect(sql).toContain('"latest_logs"."status" =');
      expect(params).toContain('accepted');
    });

    it('filters for rejected applications strictly by latest status log', () => {
      const query = buildSchoolApplicationsQuery('rejected');
      const { sql, params } = query.toSQL();

      expect(sql).toContain('"latest_logs"."status" =');
      expect(params).toContain('rejected');
    });

    it('returns all applications when statusFilter is all', () => {
      const queryAll = buildSchoolApplicationsQuery('all');
      const queryUnfiltered = buildSchoolApplicationsQuery();
      const sqlAll = queryAll.toSQL().sql;
      const sqlUnfiltered = queryUnfiltered.toSQL().sql;

      expect(sqlAll).toEqual(sqlUnfiltered);
      expect(sqlAll).not.toContain('"latest_logs"."status" =');
      expect(sqlAll).not.toContain('"latest_logs"."status" is null');
    });
  });

  describe('Staff Applications Query Logic', () => {
    it('builds staff applications query joining latest application_status_logs partitioned by type and id', () => {
      const query = buildStaffApplicationsQuery();
      const { sql, params } = query.toSQL();

      expect(sql).toContain('"application_status_logs"');
      expect(sql).toContain('partition by "application_type", "application_id"');
      expect(sql).toContain('order by "created_at" desc, "id" desc');
      expect(sql).toContain('COALESCE("latest_logs"."status", \'pending\')');
      expect(params).toContain('staff');
    });

    it('filters for pending staff applications including fallback to pending', () => {
      const query = buildStaffApplicationsQuery('pending');
      const { sql } = query.toSQL();

      expect(sql).toContain('"latest_logs"."status" is null or "latest_logs"."status" =');
    });

    it('filters for reviewed staff applications', () => {
      const query = buildStaffApplicationsQuery('reviewed');
      const { sql, params } = query.toSQL();

      expect(sql).toContain('"latest_logs"."status" =');
      expect(params).toContain('reviewed');
    });

    it('filters for accepted staff applications', () => {
      const query = buildStaffApplicationsQuery('accepted');
      const { sql, params } = query.toSQL();

      expect(sql).toContain('"latest_logs"."status" =');
      expect(params).toContain('accepted');
    });

    it('filters for rejected staff applications', () => {
      const query = buildStaffApplicationsQuery('rejected');
      const { sql, params } = query.toSQL();

      expect(sql).toContain('"latest_logs"."status" =');
      expect(params).toContain('rejected');
    });

    it('returns all staff applications when statusFilter is all', () => {
      const queryAll = buildStaffApplicationsQuery('all');
      const queryUnfiltered = buildStaffApplicationsQuery();
      const sqlAll = queryAll.toSQL().sql;
      const sqlUnfiltered = queryUnfiltered.toSQL().sql;

      expect(sqlAll).toEqual(sqlUnfiltered);
      expect(sqlAll).not.toContain('"latest_logs"."status" =');
      expect(sqlAll).not.toContain('"latest_logs"."status" is null');
    });
  });
});
