import { db } from './app/lib/db';
import * as schema from './app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { 
  createSchool, 
  deleteSchool, 
  createMember, 
  deleteMember, 
  createTeam, 
  deleteTeam, 
  createRoster, 
  deleteRoster, 
  createRosterMember, 
  updateRosterMember, 
  deleteRosterMember 
} from './app/(admin)/admin/roster/actions';

// We run the simulation inside a main block.
async function runQASimulation() {
  console.log('=== SENIOR UX QA SIMULATION RUNNER ===');
  
  // Fetch a base game and season to use in our registration flow.
  const allGames = await db.select().from(schema.games);
  const allSeasons = await db.select().from(schema.seasons);
  
  if (allGames.length === 0 || allSeasons.length === 0) {
    console.error('FAIL: Simulation requires seeded games and seasons. Run npm run db:seed first.');
    process.exit(1);
  }
  
  const targetGame = allGames[0];
  const targetSeason = allSeasons[0];
  console.log(`[Setup] Using Game: "${targetGame.displayName}" and Season: "${targetSeason.name}"`);

  // Clear any leftover QA test data from previous runs to ensure idempotency
  console.log('[Setup] Cleaning old QA test records if present...');
  await db.delete(schema.schools).where(eq(schema.schools.name, 'QA Test Academy'));

  let tempSchoolId: string = '';
  let tempMemberId: string = '';
  let tempTeamId: string = '';
  let tempRosterId: string = '';
  let tempPlayerId: string = '';

  try {
    // -------------------------------------------------------------
    // STEP 1: Create a School
    // -------------------------------------------------------------
    console.log('\n[Step 1] Simulating "Register School" form...');
    const schoolForm = new FormData();
    schoolForm.append('name', 'QA Test Academy');
    schoolForm.append('slug', 'qa-test-academy');
    schoolForm.append('logoUrl', 'https://example.com/logo.png');
    
    const schoolRes = await createSchool(schoolForm);
    if (!schoolRes.success || !schoolRes.school) {
      throw new Error(`Failed to create school: ${schoolRes.error}`);
    }
    
    tempSchoolId = schoolRes.school.id;
    console.log(`✓ SUCCESS: Created school "${schoolRes.school.name}" with ID: ${tempSchoolId}`);

    // Verify record in DB
    const dbSchool = await db.select().from(schema.schools).where(eq(schema.schools.id, tempSchoolId));
    if (dbSchool.length === 0) throw new Error('School not found in database after create.');
    
    // -------------------------------------------------------------
    // STEP 2: Create a School Member
    // -------------------------------------------------------------
    console.log('\n[Step 2] Simulating "Add School Member" form...');
    const memberForm = new FormData();
    memberForm.append('firstName', 'QA');
    memberForm.append('lastName', 'Tester');
    memberForm.append('schoolId', tempSchoolId);
    memberForm.append('email', 'qa.tester@school.edu');
    memberForm.append('discord', 'qatester#9999');
    memberForm.append('graduationYear', '2027');
    
    const memberRes = await createMember(memberForm);
    if (!memberRes.success || !memberRes.member) {
      throw new Error(`Failed to create member: ${memberRes.error}`);
    }
    
    tempMemberId = memberRes.member.id;
    console.log(`✓ SUCCESS: Created member "QA Tester" with ID: ${tempMemberId}`);

    // Verify record in DB
    const dbMember = await db.select().from(schema.members).where(eq(schema.members.id, tempMemberId));
    if (dbMember.length === 0) throw new Error('Member not found in database after create.');

    // -------------------------------------------------------------
    // STEP 3: Register School to Game Season (Create Team)
    // -------------------------------------------------------------
    console.log('\n[Step 3] Simulating "Register Game Team" form...');
    const teamForm = new FormData();
    teamForm.append('schoolId', tempSchoolId);
    teamForm.append('gameId', targetGame.id);
    teamForm.append('seasonId', targetSeason.id);
    
    const teamRes = await createTeam(teamForm);
    if (!teamRes.success || !teamRes.team) {
      throw new Error(`Failed to register team: ${teamRes.error}`);
    }
    
    tempTeamId = teamRes.team.id;
    console.log(`✓ SUCCESS: Registered Team with ID: ${tempTeamId}`);

    // Verify record in DB
    const dbTeam = await db.select().from(schema.teams).where(eq(schema.teams.id, tempTeamId));
    if (dbTeam.length === 0) throw new Error('Team record not found in database after register.');

    // -------------------------------------------------------------
    // STEP 4: Create a Squad Roster
    // -------------------------------------------------------------
    console.log('\n[Step 4] Simulating "Create Squad Roster" form...');
    const rosterForm = new FormData();
    rosterForm.append('teamId', tempTeamId);
    rosterForm.append('name', 'Varsity QA');
    rosterForm.append('division', 'A');
    
    const rosterRes = await createRoster(rosterForm);
    if (!rosterRes.success || !rosterRes.roster) {
      throw new Error(`Failed to create roster: ${rosterRes.error}`);
    }
    
    tempRosterId = rosterRes.roster.id;
    console.log(`✓ SUCCESS: Created roster "${rosterRes.roster.name}" with ID: ${tempRosterId}`);

    // Verify record in DB
    const dbRoster = await db.select().from(schema.rosters).where(eq(schema.rosters.id, tempRosterId));
    if (dbRoster.length === 0) throw new Error('Roster record not found in database after create.');

    // -------------------------------------------------------------
    // STEP 5: Assign Player to Roster
    // -------------------------------------------------------------
    console.log('\n[Step 5] Simulating inline "Assign Player" form...');
    const playerForm = new FormData();
    playerForm.append('rosterId', tempRosterId);
    playerForm.append('memberId', tempMemberId);
    playerForm.append('ign', 'QABoy');
    playerForm.append('role', 'player');
    
    const playerRes = await createRosterMember(playerForm);
    if (!playerRes.success || !playerRes.player) {
      throw new Error(`Failed to assign player: ${playerRes.error}`);
    }
    
    tempPlayerId = playerRes.player.id;
    console.log(`✓ SUCCESS: Assigned member as player in roster with ID: ${tempPlayerId}`);

    // Verify record in DB
    const dbPlayer = await db.select().from(schema.players).where(eq(schema.players.id, tempPlayerId));
    if (dbPlayer.length === 0) throw new Error('Player assignment not found in database after assign.');

    // -------------------------------------------------------------
    // STEP 6: Update Player Details
    // -------------------------------------------------------------
    console.log('\n[Step 6] Simulating inline player update (Make Captain + Change IGN)...');
    const updatePlayerForm = new FormData();
    updatePlayerForm.append('role', 'captain');
    updatePlayerForm.append('ign', 'QABoss');
    updatePlayerForm.append('isCaptain', 'true');
    
    const updateRes = await updateRosterMember(tempPlayerId, updatePlayerForm);
    if (!updateRes.success) {
      throw new Error(`Failed to update player: ${updateRes.error}`);
    }
    
    console.log('✓ SUCCESS: Updated player details in database.');
    
    // Verify changes
    const [updatedPlayer] = await db.select().from(schema.players).where(eq(schema.players.id, tempPlayerId));
    if (updatedPlayer.role !== 'captain' || updatedPlayer.ign !== 'QABoss' || !updatedPlayer.isCaptain) {
      throw new Error('Player detail mismatch in database after update.');
    }
    console.log(`   └ IGN updated to: "${updatedPlayer.ign}", Role updated to: "${updatedPlayer.role}", isCaptain: ${updatedPlayer.isCaptain}`);

    // -------------------------------------------------------------
    // STEP 7: Test Delete Member Safety Constraint
    // -------------------------------------------------------------
    console.log('\n[Step 7] Simulating Delete Member (Should fail due to active roster assignment)...');
    const deleteMemberFailRes = await deleteMember(tempMemberId);
    if (deleteMemberFailRes.success) {
      throw new Error('SECURITY FAIL: Member with active player record was successfully deleted. Referential integrity was bypassed!');
    }
    console.log(`✓ SUCCESS: Constraint verified. Database blocked deletion. Received warning: "${deleteMemberFailRes.error}"`);

    // -------------------------------------------------------------
    // STEP 8: Remove Player from Roster
    // -------------------------------------------------------------
    console.log('\n[Step 8] Simulating removing player from roster...');
    const removePlayerRes = await deleteRosterMember(tempPlayerId);
    if (!removePlayerRes.success) {
      throw new Error(`Failed to remove player: ${removePlayerRes.error}`);
    }
    console.log('✓ SUCCESS: Removed player assignment.');

    // Verify deletion
    const checkPlayerDeleted = await db.select().from(schema.players).where(eq(schema.players.id, tempPlayerId));
    if (checkPlayerDeleted.length > 0) throw new Error('Player record still exists in database after remove.');

    // -------------------------------------------------------------
    // STEP 9: Remove Member Record
    // -------------------------------------------------------------
    console.log('\n[Step 9] Simulating deleting member profile...');
    const deleteMemberSuccessRes = await deleteMember(tempMemberId);
    if (!deleteMemberSuccessRes.success) {
      throw new Error(`Failed to delete member after roster removal: ${deleteMemberSuccessRes.error}`);
    }
    console.log('✓ SUCCESS: Deleted member profile successfully.');

    // Verify deletion
    const checkMemberDeleted = await db.select().from(schema.members).where(eq(schema.members.id, tempMemberId));
    if (checkMemberDeleted.length > 0) throw new Error('Member record still exists in database after delete.');

    // -------------------------------------------------------------
    // STEP 10: Delete School & Test Cascade
    // -------------------------------------------------------------
    console.log('\n[Step 10] Simulating deleting School (Will cascade Team and Roster)...');
    const deleteSchoolRes = await deleteSchool(tempSchoolId);
    if (!deleteSchoolRes.success) {
      throw new Error(`Failed to delete school: ${deleteSchoolRes.error}`);
    }
    console.log('✓ SUCCESS: Deleted school profile successfully.');

    // Verify cascading deletions
    const checkSchoolDeleted = await db.select().from(schema.schools).where(eq(schema.schools.id, tempSchoolId));
    if (checkSchoolDeleted.length > 0) throw new Error('School record still exists in database.');

    const checkTeamDeleted = await db.select().from(schema.teams).where(eq(schema.teams.id, tempTeamId));
    if (checkTeamDeleted.length > 0) throw new Error('Team record was not cascaded and still exists.');

    const checkRosterDeleted = await db.select().from(schema.rosters).where(eq(schema.rosters.id, tempRosterId));
    if (checkRosterDeleted.length > 0) throw new Error('Roster record was not cascaded and still exists.');

    console.log('\n✓ ALL CASCADING DELETIONS VERIFIED.');
    console.log('\n======================================================');
    console.log('QA INTEGRITY STATUS: 100% CORRECT (ALL TESTS PASSED)');
    console.log('======================================================');

  } catch (error: any) {
    console.error('\n❌ QA TEST EXCEPTION TRACE:');
    console.error(error);
    
    // Clean up created records if possible to keep DB clean
    console.log('\n[Cleanup] Cleaning up any orphaned test records...');
    if (tempPlayerId) await db.delete(schema.players).where(eq(schema.players.id, tempPlayerId)).catch(() => {});
    if (tempRosterId) await db.delete(schema.rosters).where(eq(schema.rosters.id, tempRosterId)).catch(() => {});
    if (tempTeamId) await db.delete(schema.teams).where(eq(schema.teams.id, tempTeamId)).catch(() => {});
    if (tempMemberId) await db.delete(schema.members).where(eq(schema.members.id, tempMemberId)).catch(() => {});
    if (tempSchoolId) await db.delete(schema.schools).where(eq(schema.schools.id, tempSchoolId)).catch(() => {});
    
    process.exit(1);
  }
}

runQASimulation();
