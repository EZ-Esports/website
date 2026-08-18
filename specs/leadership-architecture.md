# Specification: Leadership Architecture & Person Profile Normalization

**Status**: Ready for Implementation  
**Target Path**: `specs/leadership-architecture.md`  
**Related Components**: `app/lib/db/schema.ts`, `app/lib/db/queries.ts`, `app/(admin)/admin/leadership/`, `app/(marketing)/leadership/`, `db/migrations/`

---

## 1. Overview & Objectives

The current leadership system uses a single flattened table (`leadership`) where every `(person, role, year)` tuple is duplicated as an isolated row. This creates data duplication across multi-year leaders (e.g. Edison Zhong serving in 5 different years), prevents centralized profile management, lacks avatar image upload support, and causes CMS search and data drift issues.

### Key Goals:
1. **Normalize Person Identity**: Introduce a dedicated `people` table to store human identities (`full_name`, `handle`, `avatar_url`, `storage_key`, `high_school`, `university`, `bio`, `discord`, `email`, etc.).
2. **Normalized Terms**: Introduce `leadership_terms` referencing `people.id` (`year`, `role`, `department`, `display_order`, `term_bio`).
3. **Avatar Upload Pipeline**: Integrate Supabase Storage (`admin-uploads` bucket) to support uploading, previewing, and automatically cleaning up old headshots.
4. **CMS Modernization**: Redesign `/admin/leadership` with profile search & autocomplete, quick assignment of existing profiles to new terms, drag-and-drop photo uploading, and year filtering.
5. **Frontend Polish**: Update `/leadership/[year]` to render Next.js optimized headshots with SVG initials fallbacks, multi-role badge collapsing, and seniority hierarchy sorting (Executive → Directors → Associates).
6. **Zero Regressions & Data Safety**: Preserve all historical records (~201 rows) and satisfy all existing safety guardrails (no cascade deletes on member links, preserve `unstable_cache` tags, pass all 387+ unit tests).

---

## 2. Database Schema Design

### 2.1 `people` Table
Stores normalized person profiles across all roles and years.

```typescript
export const people = pgTable('people', {
  id: uuid('id').defaultRandom().primaryKey(),
  fullName: text('full_name').notNull(),
  preferredName: text('preferred_name'),
  handle: text('handle'),
  avatarUrl: text('avatar_url'),
  storageKey: text('storage_key'),
  highSchool: text('high_school'),
  university: text('university'),
  graduationYear: integer('graduation_year'),
  bio: text('bio'),
  email: text('email'),
  discord: text('discord'),
  userId: uuid('user_id').references(() => staffMembers.userId, { onDelete: 'set null' }),
  memberId: uuid('member_id').references(() => members.id, { onDelete: 'set null' }),
  isActive: boolean('is_active').default(true).notNull(),
  deletedAt: timestamp('deleted_at'),
  deletedBy: text('deleted_by'),
  ...auditColumns,
}, (table) => [
  index('people_full_name_idx').on(table.fullName),
  index('people_handle_idx').on(table.handle),
]).enableRLS();
```

### 2.2 `leadership_terms` Table
Stores specific yearly leadership appointments linked to a person.

```typescript
export const leadershipTerms = pgTable('leadership_terms', {
  id: uuid('id').defaultRandom().primaryKey(),
  personId: uuid('person_id')
    .references(() => people.id, { onDelete: 'cascade' })
    .notNull(),
  year: text('year').notNull(), // e.g. "2026", "2025"
  role: text('role').notNull(), // e.g. "President", "CTO", "Marketing Director"
  department: text('department'), // e.g. "Executive", "Operations", "Marketing", "Product", "Broadcasting"
  displayOrder: integer('display_order').default(0).notNull(),
  termBio: text('term_bio'), // optional role-specific override
  deletedAt: timestamp('deleted_at'),
  deletedBy: text('deleted_by'),
  ...auditColumns,
}, (table) => [
  index('leadership_terms_year_idx').on(table.year),
  index('leadership_terms_person_id_idx').on(table.personId),
  uniqueIndex('leadership_terms_person_year_role_idx')
    .on(table.personId, table.year, table.role)
    .where(sql`deleted_at IS NULL`),
]).enableRLS();
```

### 2.3 Backwards Compatibility & Table Sync
To ensure existing tests (such as `seed-guards.test.ts` which asserts constraints on `leadership`) and archive seeders continue to run without interruption:
- Maintain `leadership` table compatibility in schema and queries.
- `getCachedLeadership()` query will join `leadership_terms` and `people` (falling back to legacy `leadership` records if any remain unmigrated).

---

## 3. Migration & Backfill Plan

1. **Schema Definition**: Add `people` and `leadership_terms` to `app/lib/db/schema.ts`.
2. **Database Push / Migration**: Apply the schema to the database.
3. **Data Backfill Script (`db/backfill-leadership.ts`)**:
   - Query all existing records in `leadership`.
   - Normalize and deduplicate people into `people` records (matching on normalized full name, handle, and universities/high schools).
   - Insert their historical appointments into `leadership_terms`.
   - Calculate reasonable default `department` and `displayOrder` based on role names:
     - Executive (President, Founder, CTO, VP): `displayOrder = 1`
     - Directors / Leads (Marketing Director, Operations Director, Game Directors): `displayOrder = 2`
     - Associates / Staff: `displayOrder = 3`
     - Advisors / Special Thanks: `displayOrder = 4`

---

## 4. Image Upload & Supabase Storage Pipeline

- **Storage Bucket**: `admin-uploads`
- **Path Pattern**: `leadership/{person_id}/{timestamp}.{ext}`
- **Server Action Cleanup**:
  When a person's avatar is updated or removed in CMS, check their existing `storage_key`. If an old `storage_key` exists and differs from the new one, delete the old file using `createServiceClient().storage.from('admin-uploads').remove([oldKey])`.

---

## 5. CMS Redesign (`/admin/leadership`)

### 5.1 Features
1. **Year Filter Bar**: Select a specific year (2026, 2025, 2024...) or "All Years".
2. **Search Bar**: Instant filtering by person name, role, handle, high school, or university.
3. **Dual Officer Creation Workflow**:
   - **Option A - Assign Existing Profile**: Search dropdown of existing `people` records. Selecting an existing person auto-fills their photo and school info; only requires setting Year, Role, Department, and Display Order.
   - **Option B - Create New Person & Term**: Form to fill in Full Name, Handle, High School, University, Bio, and upload Headshot image, then assigns initial Year & Role.
4. **Image Upload Component**:
   - Supports Drag-and-Drop, file browser, and instant image preview before submission.
   - Accepts JPG, PNG, WebP (max 5MB).
5. **Editing Capabilities**:
   - Edit Term specifics (Role, Year, Department, Display Order).
   - Edit Person details (Name, Handle, Photo, Schools, Bio) directly from the row editor.

---

## 6. Frontend Redesign (`/leadership/[year]`)

1. **Optimized Next.js `<Image>`**:
   - High-quality circular headshot with fallback to stylish initials monogram avatar when no photo is uploaded.
2. **Multi-Role Collapsing**:
   - If a person holds multiple roles in that year (e.g. Edison Zhong as *President* and *Founder*), group them into **one** card with multiple role badges.
3. **Role Seniority Hierarchy**:
   - Sort cards by `displayOrder ASC`, then by `role`, then by `name`.
   - Executives appear first, followed by Department Directors, followed by Associates.

---

## 7. Quality & Verification Gates

- [ ] All unit tests pass with `npm test`.
- [ ] TypeScript compilation succeeds with `npx tsc --noEmit`.
- [ ] No regression in `seed-guards.test.ts` or historical test files.
- [ ] Cache invalidation via `revalidateTag('leadership')` verified on all mutation actions.
