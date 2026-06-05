import { pgTable, uuid, text, timestamp, integer, boolean, index } from 'drizzle-orm/pg-core';

// Games configuration table
export const games = pgTable('games', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').unique().notNull(),
  displayName: text('display_name').notNull(),
  shortName: text('short_name').notNull(),
  imageUrl: text('image_url'),
});

// Seasons config
export const seasons = pgTable('seasons', {
  id: uuid('id').defaultRandom().primaryKey(),
  gameId: uuid('game_id')
    .references(() => games.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(), // e.g. "Spring 2025"
  isActive: boolean('is_active').default(true).notNull(),
}, (table) => [
  index('seasons_game_id_idx').on(table.gameId),
]);

// Teams playing under a game
export const teams = pgTable('teams', {
  id: uuid('id').defaultRandom().primaryKey(),
  gameId: uuid('game_id')
    .references(() => games.id)
    .notNull(),
  name: text('name').notNull(), // e.g. "Stuyvesant"
}, (table) => [
  index('teams_game_id_idx').on(table.gameId),
]);

// Rosters for teams
export const rosters = pgTable('rosters', {
  id: uuid('id').defaultRandom().primaryKey(),
  teamId: uuid('team_id')
    .references(() => teams.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(), // e.g. "Varsity", "JV"
  division: text('division').notNull(), // "Varsity" | "JV"
  wins: integer('wins').default(0).notNull(),
  losses: integer('losses').default(0).notNull(),
}, (table) => [
  index('rosters_team_id_idx').on(table.teamId),
]);

// Players under a roster
export const players = pgTable('players', {
  id: uuid('id').defaultRandom().primaryKey(),
  rosterId: uuid('roster_id')
    .references(() => rosters.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  role: text('role').notNull(), // "Captain", "Player", "Coach", "Sub"
  bio: text('bio'),
}, (table) => [
  index('players_roster_id_idx').on(table.rosterId),
]);

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
  status: text('status').default('scheduled').notNull(), // "scheduled" | "live" | "completed"
}, (table) => [
  index('matches_scheduled_at_idx').on(table.scheduledAt),
  index('matches_season_id_idx').on(table.seasonId),
  index('matches_home_roster_id_idx').on(table.homeRosterId),
  index('matches_away_roster_id_idx').on(table.awayRosterId),
]);

// News Posts / CMS Articles
export const newsPosts = pgTable('news_posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').unique().notNull(),
  excerpt: text('excerpt'),
  content: text('content').notNull(), // markdown/rich-text
  category: text('category').notNull(), // "Announcement", "Tournament", etc.
  publishedAt: timestamp('published_at').defaultNow().notNull(),
}, (table) => [
  index('news_posts_published_at_idx').on(table.publishedAt),
]);

// Leadership team members
export const leadership = pgTable('leadership', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  year: text('year').notNull(), // e.g., "2025"
  bio: text('bio'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('leadership_year_idx').on(table.year),
]);
