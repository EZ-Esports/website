# spec-011: Player Onboarding, School Manager Portal, and Hexagonal Tournament Verification (V1)

- **Status:** Proposed
- **PR:** not opened yet (worktree `feat/player-onboarding-v1`)
- **Date:** 2026-09-30
- **Scope:** 
  - Schema & Migrations: `app/lib/db/schema.ts`, `db/migrations/0037_player_onboarding_and_manager_portal.sql`
  - Auth & RBAC: `app/lib/roles.ts`, `app/lib/staff-access.ts`, `app/lib/auth.ts`
  - Core Domain & Hexagonal Ports: `app/lib/onboarding/ports.ts`, `app/lib/onboarding/adapters/riot-manual.ts`, `app/lib/onboarding/adapters/discord-rest.ts`
  - Portal Surface: `app/(portal)/portal/...` (Manager Dashboard, Roster Management, Approve/Reject Queue)
  - Player Onboarding Surface: `app/(marketing)/join/[schoolSlug]/[gameSlug]/page.tsx`, `app/(marketing)/join/onboarding-wizard.tsx`
  - Staff CMS: `app/(admin)/admin/schools/actions.ts`, `app/(admin)/admin/roster/...`, `app/components/admin/SchoolManagerModal.tsx`
  - Tests: `app/lib/__tests__/onboarding-*.test.ts`, `app/lib/db/__tests__/school-managers.test.ts`

---

## 1. Context & Motivation

Historically, EZ Esports collected player verification and demographic data through a 36-question Google Form (*[EZ Esports] VALORANT Player Verification Form 2025-26*). Roster tracking lived in SharePoint spreadsheets, and match operations relied on staff manually chasing down Discord tags and Riot usernames.

This model created critical operational bottlenecks:
1. **Comp Ops Rule Disputes:** Players claimed *"I didn't know the rules"* or *"I didn't see the Discord announcement"* because server entry was never verified before roster confirmation.
2. **Missing Match Voice Access:** Teams arrived on match night without all 5 players in the official Discord server, causing match delays while referees hunted down voice comms.
3. **Manager Disconnect:** Schools had no dedicated portal to view their active player pool, assemble lineups, or manage roster logistics.
4. **Student Privacy Exposure:** Minor student demographic data (free/reduced lunch status, race, country of birth) sat in shared spreadsheets and unsegmented tables rather than an isolated, permission-gated vault adhering to New York State Education Law § 2-D and FERPA.

Spec-008 defines the V1 architecture for **Staff-Provisioned School Managers**, **Per-Player One-Time Onboarding Links**, **Discord OAuth Guild Verification**, **Hexagonal Game Identity Abstraction**, and **Real-Time Tournament Roster Gates**.

---

## 2. Core Architecture: Three Dedicated Surfaces

The platform is strictly divided into three web surfaces:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        EZ ESPORTS ARCHITECTURE                         │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  1. PUBLIC MARKETING & COMPETITION (/)                                 │
│     - Public game hubs, schedules, standings, news, rules             │
│     - Edge-cached via Vercel Data Cache (unstable_cache)               │
│     - Zero student PII exposure                                        │
│                                                                        │
│  2. STAFF CMS (/admin)                                                 │
│     - Gated by staffMembers & bitmask Permissions                      │
│     - Lead Admin provisions vetted School Managers                     │
│     - NEW: VIEW_STUDENT_DEMOGRAPHICS permission flag locks PII         │
│                                                                        │
│  3. UNIFIED PORTAL (/portal)                                           │
│     - For School Managers:                                             │
│       * Manage rosters per game (e.g. Stuyvesant Valorant / LoL)       │
│       * Generate personalized one-time invite links                    │
│       * Approve / Reject incoming player applications                  │
│       * Enter teams into tournaments with live eligibility gates       │
│     - For Players:                                                     │
│       * View player profile, verified Riot ID, Discord status          │
│       * Team assignments & match schedule                              │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Hexagonal Architecture (Ports & Adapters)

To guarantee that the platform launches without friction and without waiting months for external enterprise developer approvals, the core domain is decoupled from external game and community platforms:

```
                  ┌──────────────────────────────────────────────┐
                  │            CORE ONBOARDING DOMAIN            │
                  │  - Roster State Machine                      │
                  │  - Eligibility Rules (Min 6, in-server, etc) │
                  │  - Player Profile & Demographics             │
                  └──────────────┬────────────────┬──────────────┘
                                 │                │
                        [GameIdentityPort]  [CommunityPlatformPort]
                                 │                │
            ┌────────────────────┴───┐            │
            ▼                        ▼            ▼
   [ManualRiotIdAdapter]    [RiotSignOnAdapter] [DiscordRestAdapter]
   (V1: Input Name#Tag)     (V2: Future RSO)    (OAuth + guilds.join)
```

### A. Game Identity Port (`GameIdentityPort`)
- **Port Interface**:
  ```typescript
  export interface GameIdentityPort {
    resolveIdentity(gameSlug: string, identifier: string): Promise<{
      gameId: string;
      displayName: string;
      rawIdentifier: string;
      isVerified: boolean;
    }>;
  }
  ```
- **V1 Adapter (`ManualRiotIdAdapter`)**:
  - Accepts Riot ID (`gameName#tagLine`).
  - Validates format against regex `/^.{3,16}#[a-zA-Z0-9]{3,5}$/`.
  - Normalizes and stores the identity.
  - Automatically derives public `tracker.gg` URL for comp ops without requiring the player to paste links.
- **V2 Forward-Compatibility (`RiotSignOnAdapter`)**:
  - When Riot approves production RSO, this adapter handles the OpenID Connect code exchange and maps the immutable `puuid`. The core onboarding domain, database schema, and manager portal require **zero changes**.

### B. Community Platform Port (`CommunityPlatformPort`)
- **Port Interface**:
  ```typescript
  export interface CommunityPlatformPort {
    addMemberToGuild(discordUserId: string, accessToken: string): Promise<{ joined: boolean; alreadyMember: boolean }>;
    isMemberInGuild(discordUserId: string): Promise<boolean>;
    syncMemberRoles(discordUserId: string, roleIds: string[]): Promise<void>;
  }
  ```
- **Adapter (`DiscordRestAdapter`)**:
  - Stateless REST client using `@discordjs/rest` and the privileged `DISCORD_BOT_TOKEN`.
  - **Zero Gateway WebSockets in Next.js Serverless**: Avoids connection freezes and protects Discord's 1,000 daily `IDENTIFY` limit.
  - Uses `PUT /guilds/{guild_id}/members/{user_id}` with `guilds.join` OAuth token to automatically place the student in the official EZ Esports server.
  - Fallback: If student has reached Discord's 100-server cap, surfaces a user-friendly modal with the direct invite link (`discord.gg/ezesports`).

---

## 4. Detailed Workflows

### Flow 1: Staff Provisions School Manager
1. Staff verifies the school manager/coach out-of-band.
2. In `/admin/schools/[id]`, an admin clicks **"Provision Manager"**, inputs the manager's email, and selects their assigned games (e.g. *Valorant*, *League of Legends*, or *All Games*).
3. The server generates a single-use SHA-256 hashed invite token stored in `school_manager_invites`.
4. Manager opens `ezesports.org/portal/claim?token=...`, sets up their account (or signs in with existing email/Google), and claims management of their school.
5. **Turnover & Graduation**: Managers cannot invite other managers. When a student manager graduates, Staff deactivates their account and provisions the new manager.

### Flow 2: Manager Generates Player Invite Link
1. Manager logs into `/portal`, selects their school and game (e.g. *Stuyvesant — Valorant*).
2. Clicks **"Create Player Invite"**.
3. Inputs:
   - **Intended Student First & Last Name** (e.g. "Alex Chen").
   - **Link Expiration**: Dropdown with options for 3, 7 (default), or 14 days.
4. System creates a `player_invites` record and outputs:  
   `https://ezesports.org/join/stuyvesant/valorant?token=tok_8f92ab`
5. The portal shows the invite under **Invites Sent** (`Alex Chen | Pending | Expires in 7 days`).

### Flow 3: Player Onboarding Wizard
The student opens the link. The wizard renders 4 streamlined steps:

* **Header / Greeting**: *"Welcome Alex Chen! Complete your player onboarding for Stuyvesant Valorant."*
* **Step 1: Account Authentication**:
  - Student logs in via Email Magic Link / OTP or Google (ensuring access across NYC DOE school Wi-Fi and Chromebooks).
* **Step 2: Discord Connection (Comms & Voice Gate - Honor System)**:
  - Student inputs their Discord username / handle (e.g. `@alexchen` or `alex#1234`).
  - Student is provided the direct EZ Esports Discord invite link (`discord.gg/ezesports`).
  - Confirmation checkbox: *"I confirm that I have joined the official EZ Esports Discord server with this account."*
  - Eliminates external bot dependency and live OAuth friction during onboarding while preserving server membership expectations.
* **Step 3: Riot Games Identity**:
  - Student inputs Riot ID (`Demon1#LFT1`).
  - Checkbox: *"I confirm this IGN matches my in-game account. I agree to notify my manager and staff before changing my IGN."*
* **Step 4: Demographics & Research Survey**:
  - **Core Eligibility**: Legal Full Name, High School, Anticipated Graduation Year (9th–12th), Date of Birth, Rulebook & Code of Conduct signature.
  - **Equity & Grant Demographics (Staff-Only Vault)**: Gender identity, Race/Ethnicity, Country of birth, Primary language spoken at home, Free/Reduced lunch eligibility (Title I metric), First-generation college student, NYCDOE esports petition consent.
  - **Tech & Gaming Survey**: Home internet reliability, average ping, gaming hours per week, peripherals, career interests, feedback.
* **Submission**: Moves invite status to `submitted`. System saves draft if closed midway, allowing resumption using the same token until final submission.

### Flow 4: Manager Approve / Reject Queue
1. In `/portal`, the student appears in the **Approve / Reject Queue** under that game.
2. Manager sees: *Alex Chen | IGN: Demon1#LFT1 | Discord: @comaticx | Grade: 11th*.
   - **Privacy Boundary**: Manager **cannot** view sensitive demographic PII (free lunch status, race, birth country).
3. Manager clicks **"Approve"**:
   - Student enters the school's active player pool for that game.
   - Invite status updates to `accepted`.
4. If an uninvited troll obtained the link, Manager clicks **"Reject"** with an optional note, invalidating the submission.

### Flow 5: Tournament Registration & Real-Time Roster Gate
When registering for an upcoming tournament season (e.g. *Fall 2026 Valorant Championship*):
1. Manager selects 5 Starters + at least 1 Substitute from their approved pool.
2. **The 5-Point Validation Gate**:
   - ✅ Roster size satisfies game constants (e.g. Min 6 for Valorant).
   - ✅ Exactly 1 designated Team Captain.
   - ✅ 100% of selected players have verified Riot IDs.
   - ✅ 100% of selected players have linked Discord accounts.
   - ✅ **Live Discord Guild Check**: System verifies each player is currently present in the official EZ Esports server.
   - *Failure State*: If a player left the server, the UI displays:  
     ⚠️ *"Cannot submit roster: Tyler Vance is not in the Discord server. Have them rejoin via discord.gg/ezesports."*
3. Once all gates pass, Manager clicks **"Confirm Registration"**. Roster moves to `SUBMITTED`.

### Flow 6: Match-Day Emergency Substitutions
- If Starter #3's computer crashes 15 minutes before match start, the Manager or Team Captain can open the match fixture in `/portal` and click **"Emergency Sub"**.
- Manager swaps Starter #3 for any **pre-registered, approved Substitute** on the roster.
- The platform atomically updates the match lineup and automatically broadcasts the change to the match ops room on Discord. Zero admin delays; zero unverified ringers.

---

## 5. Staff RBAC Re-haul: Protecting Student Demographics

In [`app/lib/roles.ts`](file:///Users/shangminchen/website/app/lib/roles.ts), we add a dedicated capability flag:

```typescript
export const Permissions = {
  ADMINISTRATOR: BigInt(1) << BigInt(0),
  MANAGE_ROLES: BigInt(1) << BigInt(1),
  MANAGE_LEAGUE: BigInt(1) << BigInt(2),
  MANAGE_ROSTERS: BigInt(1) << BigInt(3),
  MANAGE_MATCHES: BigInt(1) << BigInt(4),
  MANAGE_NEWS: BigInt(1) << BigInt(5),
  MANAGE_LEADERSHIP: BigInt(1) << BigInt(6),
  MANAGE_GALLERY: BigInt(1) << BigInt(7),
  MANAGE_SPONSORS: BigInt(1) << BigInt(8),
  MANAGE_APPLICATIONS: BigInt(1) << BigInt(9),
  MANAGE_SCHOOLS: BigInt(1) << BigInt(10),
  MANAGE_CONTENT: BigInt(1) << BigInt(11),
  // NEW: Dedicated gate for minor student demographic & equity PII
  VIEW_STUDENT_DEMOGRAPHICS: BigInt(1) << BigInt(12),
} as const;
```

### Access Invariants:
1. `isOwner` and `ADMINISTRATOR` pass all checks and can view student demographics.
2. Referees, Casters, Writers, and general staff **cannot** view demographic PII.
3. In `/admin/roster`, clicking on a player expands their details:
   - Non-compliance staff see: IGN, School, Discord, Grade.
   - Staff with `VIEW_STUDENT_DEMOGRAPHICS` see the full demographics drawer (survey answers, Title I status, DOB).
   - If the actor lacks the flag, the server action strips all demographic fields from the returned JSON payload.

---

## 6. Database Schema Specifications

```typescript
// 1. School Managers (Scoped tenancy)
export const schoolManagers = pgTable('school_managers', {
  id: uuid('id').defaultRandom().primaryKey(),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').notNull(), // Supabase auth.users.id
  managedGames: text('managed_games').array(), // null = all games; ['valorant'] = scoped
  academicYear: text('academic_year').notNull(), // e.g. "2025-2026"
  isPrimaryContact: boolean('is_primary_contact').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  uniqueIndex('school_managers_school_user_year_idx').on(t.schoolId, t.userId, t.academicYear),
  index('school_managers_user_id_idx').on(t.userId),
]).enableRLS();

// 2. Single-Use Player Invite Tokens
export const playerInvites = pgTable('player_invites', {
  id: uuid('id').defaultRandom().primaryKey(),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }).notNull(),
  gameId: uuid('game_id').references(() => games.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: text('token_hash').notNull().unique(), // SHA-256
  intendedFirstName: text('intended_first_name').notNull(),
  intendedLastName: text('intended_last_name').notNull(),
  invitedByUserId: uuid('invited_by_user_id').notNull(),
  status: text('status').default('pending').notNull(), // 'pending' | 'submitted' | 'accepted' | 'rejected' | 'expired'
  expiresAt: timestamp('expires_at').notNull(),
  submittedAt: timestamp('submitted_at'),
  reviewedAt: timestamp('reviewed_at'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('player_invites_school_game_idx').on(t.schoolId, t.gameId),
  uniqueIndex('player_invites_token_hash_idx').on(t.tokenHash),
]).enableRLS();

// 3. Player Game & Community Identities
export const playerIdentities = pgTable('player_identities', {
  id: uuid('id').defaultRandom().primaryKey(),
  memberId: uuid('member_id').references(() => members.id, { onDelete: 'cascade' }).notNull(),
  provider: text('provider').notNull(), // 'discord' | 'riot'
  providerUserId: text('provider_user_id').notNull(), // Discord snowflake or Riot Name#Tag
  providerUsername: text('provider_username').notNull(),
  inGuild: boolean('in_guild').default(false).notNull(),
  lastVerifiedAt: timestamp('last_verified_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('player_identities_provider_user_idx').on(t.provider, t.providerUserId),
  index('player_identities_member_id_idx').on(t.memberId),
]).enableRLS();

// 4. Student Demographics & Survey Vault (Strict RLS)
export const studentDemographics = pgTable('student_demographics', {
  id: uuid('id').defaultRandom().primaryKey(),
  memberId: uuid('member_id').references(() => members.id, { onDelete: 'cascade' }).notNull().unique(),
  legalFirstName: text('legal_first_name').notNull(),
  legalLastName: text('legal_last_name').notNull(),
  birthDate: timestamp('birth_date').notNull(),
  gender: text('gender'),
  race: text('race').array(),
  ethnicity: text('ethnicity').array(),
  countryOfBirth: text('country_of_birth'),
  parentsCountryOfBirth: text('parents_country_of_birth'),
  primaryLanguageAtHome: text('primary_language_at_home'),
  isFreeOrReducedLunch: boolean('is_free_or_reduced_lunch'),
  isFirstGenCollege: boolean('is_first_gen_college'),
  doePetitionConsent: boolean('doe_petition_consent').default(false).notNull(),
  surveyDetails: jsonb('survey_details'), // gaming sentiment, ping, hours, career interests
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('student_demographics_member_id_idx').on(t.memberId),
]).enableRLS();
```

---

## 7. Invariants & Guardrails

1. **Zero-PII Cache Invariant:** `studentDemographics` queries are **never** wrapped in `unstable_cache`. Public queries (`getCachedTeams`, `getCachedMembers`) project only `ign`, `displayName`, and `schoolId`.
2. **Deterministic Anti-IDOR Server Actions:** Mutations on rosters or players in `/portal` accept the target entity ID (e.g. `rosterId`), trace `roster -> team -> schoolId` in Postgres, and assert active manager status for that school.
3. **Stateless Discord Execution:** Next.js Server Actions execute Discord REST calls exclusively (`fetch` to Discord API v10). No persistent WebSocket gateways run in serverless functions.
4. **Hexagonal Swappability:** Riot account resolution accesses `GameIdentityPort`. Upgrading from manual Riot ID to RSO requires swapping the adapter without touching core business logic or tables.
5. **Cascading Cache Invalidation:** When a roster is submitted, approved, or an emergency sub is swapped, Server Actions invoke `updateCacheTags(CACHE_TAGS.ROSTERS, CACHE_TAGS.PLAYERS, CACHE_TAGS.TEAMS)`.

---

## 8. Verification & Test Plan

1. **Manager Provisioning:**
   - Run unit test verifying only staff with `MANAGE_SCHOOLS` can create manager invites.
   - Verify manager invite links expire after TTL and cannot be claimed twice.
2. **Player Onboarding Flow:**
   - Test personalized link resolves with student's first/last name.
   - Test Discord OAuth callback auto-adds member and validates `inGuild: true`.
   - Test submission places player into `player_invites` with status `submitted`.
3. **Approve / Reject Queue:**
   - Test that approving a player converts them into an active `members` and `players` record under that game.
   - Test that rejecting marks invite `rejected` and cleans up pending records.
4. **Eligibility Gate & Roster Lock:**
   - Verify submission fails if any player is not in the Discord server or roster size < 6.
   - Verify emergency substitution swaps starters and bench subs without staff intervention while recording an audit log.
5. **Demographic Security Audit:**
   - Verify staff without `VIEW_STUDENT_DEMOGRAPHICS` cannot read `student_demographics` rows.
   - Verify manager queries never leak demographic JSON to `/portal`.
