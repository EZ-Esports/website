/**
 * League roster size limits. Pure (no server or client imports) so the server actions that
 * enforce them and the roster UIs that explain them share one definition.
 *
 * - A roster holds at most MAX_ROSTER_PLAYERS rows in `players` (every role counts: players,
 *   captain, subs, coaches), and at most MAX_ROSTER_SUBS of them may be substitutes.
 * - These are caps on ADDING someone to a roster (enroll, invite approval, staff add, move) and on
 *   changing someone to a sub. They are enforced in application code only; there is no database
 *   constraint, and rosters that already exceed them are left alone.
 * - Tournament eligibility (`getRosterEligibility`) is deliberately minimum-only and must never
 *   import these constants: being allowed to field a roster and being allowed to grow it are
 *   separate rules.
 */
export const MAX_ROSTER_PLAYERS = 10;
export const MAX_ROSTER_SUBS = 5;

export interface RosterOccupancy {
  /** All players on the roster, counting the person being added or changed only if already there. */
  playerCount: number;
  subCount: number;
}

/** Occupancy of a roster from its role list, optionally ignoring one row (the player being edited). */
export function occupancyOf(rows: Array<{ id: string; role: string }>, exceptPlayerId?: string): RosterOccupancy {
  const others = exceptPlayerId ? rows.filter((r) => r.id !== exceptPlayerId) : rows;
  return { playerCount: others.length, subCount: others.filter((r) => r.role === 'sub').length };
}

export function rosterFullMessage(rosterName: string): string {
  return `${rosterName} is full (${MAX_ROSTER_PLAYERS} of ${MAX_ROSTER_PLAYERS} players).`;
}

export function rosterSubsFullMessage(rosterName: string): string {
  return `${rosterName} already has ${MAX_ROSTER_SUBS} substitutes.`;
}

/**
 * Why `role` cannot be placed on a roster whose OTHER players are `occupancy`, or null if it can.
 * `joining` is true when the person is not on the roster yet (enroll, approve, add, move); a role
 * edit of someone already on it passes false, so only the substitute cap applies.
 */
export function rosterCapacityError(args: {
  rosterName: string;
  occupancy: RosterOccupancy;
  role: string;
  joining: boolean;
}): string | null {
  const { rosterName, occupancy, role, joining } = args;
  if (joining && occupancy.playerCount >= MAX_ROSTER_PLAYERS) return rosterFullMessage(rosterName);
  if (role === 'sub' && occupancy.subCount >= MAX_ROSTER_SUBS) return rosterSubsFullMessage(rosterName);
  return null;
}

/** Short reason shown next to a Move target that cannot take this player, or null if it can. */
export function moveBlockedReason(
  target: { name: string; playerCount: number; subCount: number },
  moverIsSub: boolean
): string | null {
  if (target.playerCount >= MAX_ROSTER_PLAYERS) {
    return `${target.name} is full (${target.playerCount}/${MAX_ROSTER_PLAYERS})`;
  }
  if (moverIsSub && target.subCount >= MAX_ROSTER_SUBS) {
    return `${target.name} has ${MAX_ROSTER_SUBS} subs`;
  }
  return null;
}

export interface MoveMenuItem {
  id: string;
  /** What the item reads: the roster name, or the reason it cannot be chosen. */
  text: string;
  isDisabled: boolean;
}

/** The items of a Move menu (a team with more than two rosters): blocked targets stay visible but disabled. */
export function moveMenuItems(
  targets: Array<{ id: string; name: string; playerCount: number; subCount: number }>,
  moverIsSub: boolean
): MoveMenuItem[] {
  return targets.map((t) => {
    const blocked = moveBlockedReason(t, moverIsSub);
    return { id: t.id, text: blocked ?? t.name, isDisabled: blocked !== null };
  });
}
