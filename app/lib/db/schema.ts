import { pgTable, pgView, uuid, text, timestamp, integer, boolean, index, pgEnum, uniqueIndex, bigint, primaryKey, real } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Shared audit columns
const auditColumns = {
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
};

// Enums for type safety and data integrity
export const matchStatusEnum = pgEnum('match_status', ['scheduled', 'live', 'completed', 'forfeit', 'cancelled']);
export const playerRoleEnum = pgEnum('player_role', ['captain', 'player', 'coach', 'sub']);
export const sponsorTierEnum = pgEnum('sponsor_tier', ['platinum', 'gold', 'community']);
export const applicationStatusEnum = pgEnum('application_status', ['pending', 'reviewed', 'accepted']);
export const newsStatusEnum = pgEnum('news_status', ['draft', 'published', 'archived']);

// --- CORE ENTITIES ---

// Games configuration table
export const games = pgTable('games', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').unique().notNull(),
  displayName: text('display_name').notNull(),
  shortName: text('short_name').notNull(),
  imageUrl: text('image_url'),
  storageKey: text('storage_key'),
  ...auditColumns,
}).enableRLS();

// Schools in the league
export const schools = pgTable('schools', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').unique().notNull(),
  slug: text('slug').unique().notNull(),
  logoUrl: text('logo_url'),
  storageKey: text('storage_key'),
  websiteUrl: text('website_url').default(''),
  isActive: boolean('is_active').default(true).notNull(),
  displayOrder: integer('display_order').default(0).notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
  deletedBy: text('deleted_by'),
  ...auditColumns,
}).enableRLS();

// Central repository for people (students, coaches, etc.)
export const members = pgTable('members', {
  id: uuid('id').defaultRandom().primaryKey(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').unique(),
  discord: text('discord'),
  graduationYear: integer('graduation_year'),
  schoolId: uuid('school_id')
    .references(() => schools.id, { onDelete: 'restrict' })
    .notNull(),
  ...auditColumns,
}, (table) => [
  index('members_school_id_idx').on(table.schoolId),
]).enableRLS();

// Seasons config
export const seasons = pgTable('seasons', {
  id: uuid('id').defaultRandom().primaryKey(),
  gameId: uuid('game_id')
    .references(() => games.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(), // e.g. "Spring 2025"
  isActive: boolean('is_active').default(true).notNull(),
  ...auditColumns,
}, (table) => [
  index('seasons_game_id_idx').on(table.gameId),
  uniqueIndex('seasons_game_id_name_unique_idx').on(table.gameId, table.name),
]).enableRLS();

// --- TEAMS & ROSTERS ---

// A school's presence in a specific game/season
export const teams = pgTable('teams', {
  id: uuid('id').defaultRandom().primaryKey(),
  schoolId: uuid('school_id')
    .references(() => schools.id, { onDelete: 'cascade' })
    .notNull(),
  gameId: uuid('game_id')
    .references(() => games.id, { onDelete: 'cascade' })
    .notNull(),
  seasonId: uuid('season_id')
    .references(() => seasons.id, { onDelete: 'cascade' })
    .notNull(),
  ...auditColumns,
}, (table) => [
  index('teams_school_id_idx').on(table.schoolId),
  index('teams_game_id_idx').on(table.gameId),
  index('teams_season_id_idx').on(table.seasonId),
  uniqueIndex('teams_school_game_season_unique_idx').on(table.schoolId, table.gameId, table.seasonId),
]).enableRLS();

// Specific rosters under a team (e.g. "Varsity", "JV")
export const rosters = pgTable('rosters', {
  id: uuid('id').defaultRandom().primaryKey(),
  teamId: uuid('team_id')
    .references(() => teams.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(), // e.g. "Varsity", "JV"
  division: text('division').notNull(), // "A" | "B" (aligned with docs)
  ...auditColumns,
}, (table) => [
  index('rosters_team_id_idx').on(table.teamId),
  uniqueIndex('rosters_team_name_unique_idx').on(table.teamId, table.name),
]).enableRLS();

// Mapping members to specific rosters
export const players = pgTable('players', {
  id: uuid('id').defaultRandom().primaryKey(),
  rosterId: uuid('roster_id')
    .references(() => rosters.id, { onDelete: 'cascade' })
    .notNull(),
  memberId: uuid('member_id')
    .references(() => members.id, { onDelete: 'restrict' })
    .notNull(),
  role: playerRoleEnum('role').default('player').notNull(),
  ign: text('ign'),
  bio: text('bio'),
  isCaptain: boolean('is_captain').default(false).notNull(),
  ...auditColumns,
}, (table) => [
  index('players_roster_id_idx').on(table.rosterId),
  index('players_member_id_idx').on(table.memberId),
  uniqueIndex('players_roster_member_unique_idx').on(table.rosterId, table.memberId),
  // Enforce DB-level invariant: only one captain per roster.
  // isCaptain is derived from role === 'captain'; this index guarantees the
  // two can never diverge even under concurrent writes.
  uniqueIndex('players_roster_one_captain_idx')
    .on(table.rosterId)
    .where(sql`is_captain = true`),
]).enableRLS();

// --- MATCHES ---

// Match schedules and scores
export const matches = pgTable('matches', {
  id: uuid('id').defaultRandom().primaryKey(),
  seasonId: uuid('season_id')
    .references(() => seasons.id)
    .notNull(),
  homeRosterId: uuid('home_roster_id')
    .references(() => rosters.id, { onDelete: 'cascade' })
    .notNull(),
  awayRosterId: uuid('away_roster_id')
    .references(() => rosters.id, { onDelete: 'cascade' })
    .notNull(),
  scheduledAt: timestamp('scheduled_at').notNull(),
  homeScore: integer('home_score'),
  awayScore: integer('away_score'),
  status: matchStatusEnum('status').default('scheduled').notNull(),
  mvp: text('mvp'), // match MVP as recorded in season sheets, e.g. 'Kyle "Kuli" Ng'
  notes: text('notes'), // reschedules, DQs, data-quality caveats
  ...auditColumns,
}, (table) => [
  index('matches_scheduled_at_idx').on(table.scheduledAt),
  index('matches_season_id_idx').on(table.seasonId),
  index('matches_home_roster_id_idx').on(table.homeRosterId),
  index('matches_away_roster_id_idx').on(table.awayRosterId),
]).enableRLS();

// --- CMS & LEADERSHIP ---

// News Posts / CMS Articles
export const newsPosts = pgTable('news_posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').unique().notNull(),
  excerpt: text('excerpt'),
  content: text('content').notNull(), // markdown/rich-text
  category: text('category').notNull(), // "Announcement", "Tournament", etc.
  status: newsStatusEnum('status').default('published').notNull(),
  publishedAt: timestamp('published_at'),
  deletedAt: timestamp('deleted_at'),
  deletedBy: text('deleted_by'),
  ...auditColumns,
}, (table) => [
  index('news_posts_published_at_idx').on(table.publishedAt),
]).enableRLS();

// Leadership team members
export const leadership = pgTable('leadership', {
  id: uuid('id').defaultRandom().primaryKey(),
  memberId: uuid('member_id')
    .references(() => members.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // Fallback if memberId is null
  role: text('role').notNull(),
  year: text('year').notNull(), // e.g., "2025"
  bio: text('bio'),
  deletedAt: timestamp('deleted_at'),
  deletedBy: text('deleted_by'),
  ...auditColumns,
}, (table) => [
  index('leadership_year_idx').on(table.year),
]).enableRLS();

// View for rosters with dynamically computed standings (wins and losses)
export const rosterStandings = pgView('roster_standings', {
  id: uuid('id'),
  teamId: uuid('team_id'),
  name: text('name'),
  division: text('division'),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
  wins: integer('wins'),
  losses: integer('losses'),
}).with({ securityInvoker: true }).as(sql`
  SELECT
    r.id, r.team_id, r.name, r.division, r.created_at, r.updated_at,
    (SELECT COUNT(*) FROM matches m WHERE (m.home_roster_id = r.id AND m.home_score > m.away_score AND m.status IN ('completed', 'forfeit')) OR (m.away_roster_id = r.id AND m.away_score > m.home_score AND m.status IN ('completed', 'forfeit')))::int as wins,
    (SELECT COUNT(*) FROM matches m WHERE (m.home_roster_id = r.id AND m.home_score < m.away_score AND m.status IN ('completed', 'forfeit')) OR (m.away_roster_id = r.id AND m.away_score < m.home_score AND m.status IN ('completed', 'forfeit')))::int as losses
  FROM rosters r
`);

// Historical standings snapshots imported from archived spreadsheets.
// The roster_standings view computes W/L from match rows, but most archived
// seasons have final standings without per-match scores, so those seasons are
// served from this table instead. playerName/playerIgn are set for individual
// (per-player) competitions like TFT, where a row ranks a player, not a school
// team; wins/losses stay null there and the season total lives in points.
export const seasonStandings = pgTable('season_standings', {
  id: uuid('id').defaultRandom().primaryKey(),
  seasonId: uuid('season_id')
    .references(() => seasons.id, { onDelete: 'cascade' })
    .notNull(),
  schoolId: uuid('school_id')
    .references(() => schools.id, { onDelete: 'cascade' })
    .notNull(),
  division: text('division').notNull(), // "Varsity" | "JV" | "All"
  rank: integer('rank'),
  wins: integer('wins'),
  losses: integer('losses'),
  gamesPlayed: integer('games_played'),
  winPct: real('win_pct'), // 0..1
  points: real('points'), // point-based competitions (TFT totals, regular-season points)
  playerName: text('player_name'),
  playerIgn: text('player_ign'),
  notes: text('notes'),
  ...auditColumns,
}, (table) => [
  index('season_standings_season_id_idx').on(table.seasonId),
  index('season_standings_school_id_idx').on(table.schoolId),
  index('season_standings_division_idx').on(table.division),
]).enableRLS();

// --- PHASE 2 CMS TABLES ---

// Gallery images for public gallery sections
export const galleryImages = pgTable('gallery_images', {
  id: uuid('id').defaultRandom().primaryKey(),
  src: text('src').notNull(),
  caption: text('caption').notNull().default(''),
  schoolName: text('school_name').default(''),
  eventName: text('event_name').default(''),
  displayOrder: integer('display_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  storageKey: text('storage_key'),
  deletedAt: timestamp('deleted_at'),
  deletedBy: text('deleted_by'),
  ...auditColumns,
}, (table) => [
  index('gallery_images_display_order_idx').on(table.displayOrder),
]).enableRLS();

export const sponsors = pgTable('sponsors', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  logoUrl: text('logo_url').default(''),
  tier: sponsorTierEnum('tier').default('community').notNull(),
  websiteUrl: text('website_url').default(''),
  isActive: boolean('is_active').default(true).notNull(),
  displayOrder: integer('display_order').default(0).notNull(),
  storageKey: text('storage_key'),
  deletedAt: timestamp('deleted_at'),
  deletedBy: text('deleted_by'),
  ...auditColumns,
}, (table) => [
  index('sponsors_tier_idx').on(table.tier),
  index('sponsors_display_order_idx').on(table.displayOrder),
]).enableRLS();

export const schoolApplications = pgTable('school_applications', {
  id: uuid('id').defaultRandom().primaryKey(),
  applicantName: text('applicant_name').notNull(),
  schoolName: text('school_name').notNull(),
  role: text('role').notNull(),
  email: text('email').notNull(),
  message: text('message').default(''),
  status: applicationStatusEnum('status').default('pending').notNull(),
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
  ...auditColumns,
}, (table) => [
  index('school_applications_status_idx').on(table.status),
  index('school_applications_submitted_at_idx').on(table.submittedAt),
]).enableRLS();

export const staffApplications = pgTable('staff_applications', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  preferredFirstName: text('preferred_first_name'),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  discordTag: text('discord_tag'),
  role: text('role').notNull(),
  message: text('message').default(''),
  status: applicationStatusEnum('status').default('pending').notNull(),
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
  ...auditColumns,
}, (table) => [
  index('staff_applications_status_idx').on(table.status),
  index('staff_applications_submitted_at_idx').on(table.submittedAt),
]).enableRLS();


// CMS key-value content blocks for editable page text
export const pageContent = pgTable('page_content', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: text('key').unique().notNull(),
  label: text('label').notNull(),
  content: text('content').notNull().default(''),
  ...auditColumns,
}).enableRLS();

// Audit trail for page content edits
export const pageContentHistory = pgTable('page_content_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  contentKey: text('content_key').notNull(),
  previousContent: text('previous_content').notNull(),
  savedAt: timestamp('saved_at').defaultNow().notNull(),
}, (table) => [
  index('page_content_history_key_idx').on(table.contentKey),
]).enableRLS();

// --- STAFF ACCESS CONTROL ---

// Every Supabase identity that can authenticate into the staff portal has one
// row here. Capabilities come exclusively from @everyone plus assigned roles;
// membership itself never implies a management permission.
export const staffMembers = pgTable('staff_members', {
  userId: uuid('user_id').primaryKey(),
  email: text('email').notNull().unique(),
  // user_id of the staff member who invited this one; null for the bootstrapped Owner.
  invitedBy: uuid('invited_by'),
  ...auditColumns,
}, (table) => [
  index('staff_members_email_idx').on(table.email),
]).enableRLS();

// Pending, single-use staff invitations. We store only the SHA-256 hash of the
// invite token (never the raw token), so a DB leak cannot be used to accept an
// invite. A row is consumed by setting acceptedAt; expired/accepted rows are
// ignored by the accept flow.
export const staffInvites = pgTable('staff_invites', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  invitedBy: uuid('invited_by').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  acceptedAt: timestamp('accepted_at'),
  ...auditColumns,
}, (table) => [
  index('staff_invites_email_idx').on(table.email),
  uniqueIndex('staff_invites_email_pending_unique').on(table.email).where(sql`${table.acceptedAt} is null`),
]).enableRLS();

// --- ROLE PERMISSIONS SYSTEM ---

export const roles = pgTable('roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  color: text('color').default('#94a3b8').notNull(),
  permissions: bigint('permissions', { mode: 'bigint' }).default(sql`0`).notNull(),
  position: integer('position').notNull(),
  isOwner: boolean('is_owner').default(false).notNull(),
  isSystem: boolean('is_system').default(false).notNull(),
  ...auditColumns,
}).enableRLS();

// Durable revocation tombstones. A row here prevents an old Supabase session
// (or a recreated auth identity using the same email) from auto-provisioning a
// deleted staff membership. Re-provisioning must explicitly clear the marker.
export const staffRevocations = pgTable('staff_revocations', {
  userId: uuid('user_id').primaryKey(),
  email: text('email').notNull(),
  revokedBy: uuid('revoked_by').notNull(),
  reason: text('reason'),
  revokedAt: timestamp('revoked_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('staff_revocations_email_unique_idx').on(sql`lower(${table.email})`),
  index('staff_revocations_revoked_by_idx').on(table.revokedBy),
  index('staff_revocations_revoked_at_idx').on(table.revokedAt),
]).enableRLS();

export const userRoles = pgTable('user_roles', {
  userId: uuid('user_id')
    .references(() => staffMembers.userId, { onDelete: 'cascade' })
    .notNull(),
  roleId: uuid('role_id')
    .references(() => roles.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.roleId] }),
  index('user_roles_user_id_idx').on(table.userId),
]).enableRLS();

export const staffInviteRoles = pgTable('staff_invite_roles', {
  inviteId: uuid('invite_id')
    .references(() => staffInvites.id, { onDelete: 'cascade' })
    .notNull(),
  roleId: uuid('role_id')
    .references(() => roles.id, { onDelete: 'cascade' })
    .notNull(),
}, (table) => [
  primaryKey({ columns: [table.inviteId, table.roleId] }),
]).enableRLS();

// Durable account-integrity events. Application code writes through the trusted
// server database connection; portal reads require role-management permission.
export const staffAuditLogs = pgTable('staff_audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  event: text('event').notNull(),
  userId: uuid('user_id'),
  email: text('email'),
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('staff_audit_logs_created_at_idx').on(table.createdAt),
  index('staff_audit_logs_user_id_idx').on(table.userId),
]).enableRLS();
