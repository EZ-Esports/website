import { describe, expect, it } from 'vitest';
import * as schema from '@/app/lib/db/schema';
import { db } from '@/app/lib/db';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';

describe('Career Postings Schema & Query Tests', () => {
  describe('Schema Definitions', () => {
    it('defines careerPostingStatusEnum with draft, published, closed', () => {
      expect(schema.careerPostingStatusEnum.enumValues).toEqual([
        'draft',
        'published',
        'closed',
      ]);
    });

    it('defines careerPostings table with expected columns and defaults', () => {
      const cols = schema.careerPostings;
      expect(cols.id).toBeDefined();
      expect(cols.title).toBeDefined();
      expect(cols.slug).toBeDefined();
      expect(cols.department).toBeDefined();
      expect(cols.location).toBeDefined();
      expect(cols.commitment).toBeDefined();
      expect(cols.employmentType).toBeDefined();
      expect(cols.summary).toBeDefined();
      expect(cols.description).toBeDefined();
      expect(cols.status).toBeDefined();
      expect(cols.displayOrder).toBeDefined();
      expect(cols.deletedAt).toBeDefined();
      expect(cols.deletedBy).toBeDefined();
    });

    it('ensures staffApplications has careerPostingId referencing careerPostings', () => {
      expect(schema.staffApplications.careerPostingId).toBeDefined();
      expect(schema.staffApplications.careerPostingId.notNull).toBe(false);
    });
  });

  describe('Query Generation', () => {
    it('generates expected SQL for published career postings', () => {
      const query = db
        .select({
          id: schema.careerPostings.id,
          title: schema.careerPostings.title,
          slug: schema.careerPostings.slug,
          department: schema.careerPostings.department,
          status: schema.careerPostings.status,
        })
        .from(schema.careerPostings)
        .where(
          and(
            eq(schema.careerPostings.status, 'published'),
            isNull(schema.careerPostings.deletedAt)
          )
        )
        .orderBy(asc(schema.careerPostings.displayOrder), desc(schema.careerPostings.createdAt));

      const { sql, params } = query.toSQL();
      expect(sql).toContain('from "career_postings"');
      expect(sql).toContain('"career_postings"."status" = $1');
      expect(sql).toContain('"career_postings"."deleted_at" is null');
      expect(params).toContain('published');
    });

    it('generates expected SQL for single career posting by slug', () => {
      const query = db
        .select()
        .from(schema.careerPostings)
        .where(
          and(
            eq(schema.careerPostings.slug, 'software-engineer'),
            eq(schema.careerPostings.status, 'published'),
            isNull(schema.careerPostings.deletedAt)
          )
        )
        .limit(1);

      const { sql, params } = query.toSQL();
      expect(sql).toContain('from "career_postings"');
      expect(sql).toContain('"career_postings"."slug" = $1');
      expect(sql).toContain('"career_postings"."status" = $2');
      expect(params).toContain('software-engineer');
      expect(params).toContain('published');
    });
  });
});
