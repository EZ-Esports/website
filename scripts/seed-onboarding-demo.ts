import postgres from 'postgres';
import crypto from 'node:crypto';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://shangminchen@localhost:5432/ez_worktree_player_onboarding';

const sql = postgres(connectionString);

async function seed() {
  console.log('--- SEEDING LOCAL ONBOARDING DEMO DATA ---');

  // 1. Seed Games
  console.log('Seeding games...');
  const games = await sql`
    INSERT INTO games (slug, display_name, short_name)
    VALUES 
      ('valorant', 'Valorant', 'VAL'),
      ('league-of-legends', 'League of Legends', 'LoL'),
      ('tetris', 'TETR.IO', 'TETR'),
      ('overwatch-2', 'Overwatch 2', 'OW2')
    ON CONFLICT (slug) DO UPDATE 
    SET display_name = EXCLUDED.display_name, short_name = EXCLUDED.short_name
    RETURNING id, slug, display_name;
  `;
  console.log(`Upserted ${games.length} games.`);
  const valGame = games.find((g) => g.slug === 'valorant') || games[0];
  const _lolGame = games.find((g) => g.slug === 'league-of-legends') || games[1];

  // 2. Seed Schools
  console.log('Seeding schools...');
  const schools = await sql`
    INSERT INTO schools (name, slug, is_active, display_order)
    VALUES 
      ('Stuyvesant High School', 'stuyvesant-high-school', true, 1),
      ('Bronx High School of Science', 'bronx-science', true, 2),
      ('Brooklyn Technical High School', 'brooklyn-tech', true, 3)
    ON CONFLICT (slug) DO UPDATE 
    SET name = EXCLUDED.name, is_active = EXCLUDED.is_active
    RETURNING id, slug, name;
  `;
  console.log(`Upserted ${schools.length} schools.`);
  const stuySchool = schools.find((s) => s.slug === 'stuyvesant-high-school') || schools[0];

  // 3. Seed Season
  console.log('Seeding season...');
  const [valSeason] = await sql`
    INSERT INTO seasons (game_id, name, is_active)
    VALUES (${valGame.id}, 'Fall 2026', true)
    ON CONFLICT DO NOTHING
    RETURNING id;
  ` || [];

  const seasonId = valSeason?.id || (await sql`SELECT id FROM seasons WHERE game_id = ${valGame.id} LIMIT 1`)[0]?.id;

  // 4. Seed Team & Roster
  console.log('Seeding team & roster...');
  let [team] = await sql`
    INSERT INTO teams (school_id, game_id, season_id)
    VALUES (${stuySchool.id}, ${valGame.id}, ${seasonId})
    ON CONFLICT (school_id, game_id, season_id) DO UPDATE SET updated_at = now()
    RETURNING id;
  `;
  if (!team) {
    [team] = await sql`SELECT id FROM teams WHERE school_id = ${stuySchool.id} AND game_id = ${valGame.id} AND season_id = ${seasonId}`;
  }

  let [roster] = await sql`
    INSERT INTO rosters (team_id, name, division)
    VALUES (${team.id}, 'Varsity', 'A')
    ON CONFLICT (team_id, name) DO UPDATE SET division = 'A'
    RETURNING id;
  `;
  if (!roster) {
    [roster] = await sql`SELECT id FROM rosters WHERE team_id = ${team.id} AND name = 'Varsity'`;
  }

  // 5. Seed Demo Staff / Manager User
  console.log('Seeding demo manager user...');
  const demoUserId = '00000000-0000-0000-0000-000000000001';
  const demoEmail = 'manager@stuy.edu';

  await sql`
    INSERT INTO staff_members (user_id, email)
    VALUES (${demoUserId}, ${demoEmail})
    ON CONFLICT (user_id) DO UPDATE SET email = ${demoEmail};
  `;

  // Upsert school manager
  await sql`
    INSERT INTO school_managers (school_id, user_id, academic_year, is_primary_contact, is_active)
    VALUES (${stuySchool.id}, ${demoUserId}, '2026-2027', true, true)
    ON CONFLICT (school_id, user_id, academic_year) DO UPDATE 
    SET is_active = true, is_primary_contact = true;
  `;

  // 6. Seed an applicant (submitted invite with identities and demographics)
  console.log('Seeding demo applicant awaiting manager review...');
  const rawToken = 'demo-token-alex-chen-stuy-2026';
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  // Insert a member for the applicant
  const [member] = await sql`
    INSERT INTO members (first_name, last_name, email, discord, graduation_year, school_id)
    VALUES ('Alex', 'Chen', 'alex.chen@nycstudents.net', 'DemonAlex#1234', 2027, ${stuySchool.id})
    ON CONFLICT (email) DO UPDATE 
    SET first_name = 'Alex', last_name = 'Chen'
    RETURNING id;
  `;

  // Insert player identity (Riot + Discord)
  await sql`
    INSERT INTO player_identities (member_id, provider, provider_user_id, provider_username, in_guild)
    VALUES 
      (${member.id}, 'riot', 'Demon1#LFT1', 'Demon1#LFT1', true),
      (${member.id}, 'discord', '345678901234567890', 'DemonAlex#1234', true)
    ON CONFLICT (provider, provider_user_id) DO UPDATE 
    SET in_guild = true;
  `;

  // Insert sensitive student demographics (guarded by VIEW_STUDENT_DEMOGRAPHICS)
  await sql`
    INSERT INTO student_demographics (
      member_id, legal_first_name, legal_last_name, birth_date, gender, race,
      country_of_birth, is_free_or_reduced_lunch, is_first_gen_college, doe_petition_consent, survey_details
    )
    VALUES (
      ${member.id}, 'Alexander', 'Chen', '2009-04-15', 'Male', ARRAY['Asian'],
      'United States', true, false, true, 
      ${JSON.stringify({ ping: '12ms', hoursPerWeek: 15, careerInterests: 'Computer Science' })}
    )
    ON CONFLICT (member_id) DO NOTHING;
  `;

  // Insert submitted player invite
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await sql`
    INSERT INTO player_invites (
      school_id, game_id, token_hash, intended_first_name, intended_last_name,
      invited_by_user_id, status, expires_at, member_id, submitted_at
    )
    VALUES (
      ${stuySchool.id}, ${valGame.id}, ${tokenHash}, 'Alex', 'Chen',
      ${demoUserId}, 'submitted', ${expiresAt}, ${member.id}, now()
    )
    ON CONFLICT (token_hash) DO UPDATE 
    SET status = 'submitted', member_id = ${member.id};
  `;

  // 7. Seed an unused pending invite for testing link generation / onboarding
  const newRawToken = 'test-token-fresh-signup-4567';
  const newTokenHash = crypto.createHash('sha256').update(newRawToken).digest('hex');
  await sql`
    INSERT INTO player_invites (
      school_id, game_id, token_hash, intended_first_name, intended_last_name,
      invited_by_user_id, status, expires_at
    )
    VALUES (
      ${stuySchool.id}, ${valGame.id}, ${newTokenHash}, 'Jordan', 'Lee',
      ${demoUserId}, 'pending', ${expiresAt}
    )
    ON CONFLICT (token_hash) DO NOTHING;
  `;

  console.log('--- SEEDING COMPLETE! ---');
  console.log('Demo School:', stuySchool.name, `(slug: ${stuySchool.slug})`);
  console.log('Demo Game:', valGame.display_name, `(slug: ${valGame.slug})`);
  console.log('Demo Submitted Applicant: Alex Chen (IGN: Demon1#LFT1)');
  console.log('Fresh Onboarding Link:');
  console.log(`http://localhost:3000/join/${stuySchool.slug}/${valGame.slug}?token=${newRawToken}`);

  await sql.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
