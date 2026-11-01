/**
 * The single manager-portal tour definition. The first-run tour, the full replay and
 * each per-section replay are all slices of TOUR_SECTIONS; nothing is duplicated.
 *
 * Steps target `data-tour="<anchor>"` attributes only, never classes, selectors or
 * visible text, so restyling or rewording the portal cannot silently break the tour.
 * Anchors sit on containers that always render (including for a brand-new school with
 * no submissions or rosters) or on always-present trigger buttons.
 */

import { trackerLinkStepsText } from '@/app/lib/match-results/tracker-link-help';

export const TOUR_ANCHORS = [
  'portal-header',
  'game-tabs',
  'invite-card',
  'invite-history',
  'approvals',
  'rosters',
  'create-roster',
  'matches',
  'matches-list',
  'reschedule',
  'tutorial-button',
] as const;

export type TourAnchor = (typeof TOUR_ANCHORS)[number];

export interface TourStep {
  id: string;
  anchor: TourAnchor;
  title: string;
  body: string;
}

export interface TourSection {
  id: string;
  label: string;
  steps: TourStep[];
}

export const TOUR_SECTIONS: TourSection[] = [
  {
    id: 'season-access',
    label: 'Season & access',
    steps: [
      {
        id: 'portal-header',
        anchor: 'portal-header',
        title: 'Your school and season',
        body: 'This is your school’s Manager Control Deck. The Season label shows which season you are working in. If it says Inactive season • View only, that season is over (or not started): you can look at rosters, check eligibility and see matches, but you cannot invite, approve, enroll, remove, re-role, create or delete anything.',
      },
      {
        id: 'portal-locks',
        anchor: 'portal-header',
        title: 'Locked rosters and Eastern Time',
        body: 'EZ Esports staff can lock rosters for a season. A banner appears above the rosters, and while it is up you cannot enroll, remove, move or re-role players, or create or delete rosters. Contact an admin to request a change. Every match time in the portal is Eastern Time (ET), whatever your own time zone.',
      },
    ],
  },
  {
    id: 'pick-a-game',
    label: 'Pick a game',
    steps: [
      {
        id: 'game-tabs',
        anchor: 'game-tabs',
        title: 'Start by picking a game',
        body: 'These tabs filter everything below to one game: invites, approvals, rosters and matches. Choose a game before you invite players, or stay on All Games to see everything at once. The invite form follows the game you pick.',
      },
    ],
  },
  {
    id: 'invite-players',
    label: 'Invite players',
    steps: [
      {
        id: 'invite-card',
        anchor: 'invite-card',
        title: 'Send a player invite',
        body: 'Enter the student’s first and last name, choose the game, and pick how long the link lasts (3, 5 or 7 days; 7 is standard). Generate a single-use link, which is copied for you automatically. Send it to that one student.',
      },
      {
        id: 'invite-student-flow',
        anchor: 'invite-card',
        title: 'What the student does',
        body: 'The student opens their link, signs in with Discord, verifies their Riot ID and fills in their own details. Nothing is entered by you. When they finish, their application appears in your Pending Approvals queue. An expired or already-used link stops working, so make a new invite if needed.',
      },
      {
        id: 'invite-history',
        anchor: 'invite-history',
        title: 'Track every invite',
        body: 'Every link you create is listed here with its status: Pending (not used yet), Submitted (waiting for you), Accepted or Rejected. For a Pending invite you can Copy link, which issues a brand-new link and makes the old one stop working (you are asked to confirm), or Delete it. Other statuses cannot be changed.',
      },
    ],
  },
  {
    id: 'approvals',
    label: 'Approvals',
    steps: [
      {
        id: 'approvals',
        anchor: 'approvals',
        title: 'Review submissions',
        body: 'When a student submits their invite it lands here with their verified Riot ID, Discord handle, game and graduation year. Approve to accept the student, or Reject. Approving does not put anyone on a roster; use Enroll on a roster afterwards. Nothing is waiting right now if this queue is empty.',
      },
    ],
  },
  {
    id: 'rosters',
    label: 'Rosters',
    steps: [
      {
        id: 'rosters',
        anchor: 'rosters',
        title: 'Your team rosters',
        body: 'Rosters are grouped by season, and each season can be shown or hidden. A roster card lists its players with their role, in-game name, Discord handle and whether they are in the EZ Esports Discord server (In Server or Missing). A roster holds up to 10 players, and at most 5 of them can be subs.',
      },
      {
        id: 'create-roster',
        anchor: 'create-roster',
        title: 'Create a roster',
        body: 'Start here if your school has no roster for a game yet. Choose the game, a name (for example Varsity or Junior Varsity) and a division (A, B or Open). Accepted players can then be enrolled onto it. A roster with no players can be deleted with the trash icon on its card.',
      },
      {
        id: 'enroll-players',
        anchor: 'rosters',
        title: 'Enroll players',
        body: 'Press Enroll Player on a roster, choose a student from your school pool, set their role (Starter, Substitute or Captain) and confirm their in-game name. Only students who were approved for this season are listed; invite and approve anyone else first. The button reads Roster full once a roster has 10 players.',
      },
      {
        id: 'roster-roles',
        anchor: 'rosters',
        title: 'Roles, moving and removing',
        body: 'Use the Role menu on a player to switch between Starter, Sub and Captain. A roster has one Captain, so choosing a new one replaces the old one. Move to… shifts a player to your other roster for the game (for example Varsity to JV), since a student plays on one tier per game. The trash icon removes a player after you confirm.',
      },
      {
        id: 'eligibility',
        anchor: 'rosters',
        title: 'Check eligibility',
        body: 'Press Check Eligibility on a roster to run the 5-point gate: at least 5 players, exactly one Captain, every Riot ID verified, every Discord account linked, and every player in the Discord server. Anything failing is listed under Action items. A roster is Eligible for Registration when all five pass.',
      },
    ],
  },
  {
    id: 'matches',
    label: 'Matches',
    steps: [
      {
        id: 'matches',
        anchor: 'matches',
        title: 'Your school’s matches',
        body: 'Every match your school plays is listed here, in Eastern Time, with your opponent, Home or Away, division and status. When you play in both divisions you can filter by Varsity or Junior Varsity. Results and scores stay hidden until the season is published.',
      },
      {
        id: 'match-tabs',
        anchor: 'matches-list',
        title: 'Upcoming, Needs result and Past',
        body: 'Upcoming holds matches that are live or have not started. Once a match’s start time passes with no result it moves to Needs result, and the number on that tab counts how many are waiting. Past holds matches that already have a result, or were cancelled or forfeited.',
      },
      {
        id: 'reschedule',
        anchor: 'reschedule',
        title: 'Ask to move a match',
        body: 'Use Request reschedule on an upcoming match to propose at least two new times and give a reason. The other school picks one, or suggests times of their own for you to choose from. Then EZ Esports staff approve it. Under 72 hours’ notice, the other school can say no. Open View request to see or cancel yours until a time is agreed.',
      },
      {
        id: 'reschedule-allowance',
        anchor: 'matches',
        title: 'One reschedule per season',
        body: 'Each school gets one reschedule per season. The banner above the tabs shows how many are left (Reschedules remaining 1 of 1, or 0 once used). A moved match shows a Rescheduled tag with its original time, and reschedule controls are hidden in view-only seasons.',
      },
    ],
  },
  {
    id: 'match-results',
    label: 'Submit match results',
    steps: [
      {
        id: 'result-submit',
        anchor: 'matches-list',
        title: 'Submit a Valorant result',
        body: 'For Valorant matches with no result yet, open the Needs result tab and press Submit result. You do not type a score: you paste the tracker.gg link of each game played, and the site fetches the real games, scores the series and saves it. Only a manager of either school (or EZ Esports staff) can submit, and only in an active season.',
      },
      {
        id: 'result-get-link',
        anchor: 'matches-list',
        title: 'How to get a match link',
        body: `${trackerLinkStepsText()} The same steps are in the Submit result dialog under How do I get a match link?`,
      },
      {
        id: 'result-games',
        anchor: 'matches-list',
        title: 'One link per game',
        body: 'The form has a field for each game. Game 1 and Game 2 are required. Fill in Game 3 only if the series went the distance (a 1–1 split after two games). Each link must be a different game. A bare match ID works too, and the same link can never count for two different matches.',
      },
      {
        id: 'result-rules',
        anchor: 'matches-list',
        title: 'What makes a game valid',
        body: 'Each game must be a custom game that was played to completion (not a surrender or forfeit). Every player on a team must be on that school’s roster with the same Riot ID, and the two teams must be your two schools. Team size does not matter. A player who is not on the roster gets the game refused, and the message names them, so fix the roster and resubmit.',
      },
      {
        id: 'result-timing',
        anchor: 'matches-list',
        title: 'Timing, limits and waiting',
        body: 'Match data is only kept for a limited time, so submit soon after playing. You can submit once every 30 seconds per match and ten times an hour. If the match data service is busy or down, the links are saved and the row says Waiting on the match data service: press Check again later, or Discard to start over. Nothing retries on its own.',
      },
      {
        id: 'result-scoreboard',
        anchor: 'matches-list',
        title: 'Scoreboard and fixing results',
        body: 'Once saved, the match shows the series score and a Scoreboard button with each game’s map, rounds and every player’s agent, ACS, kills, deaths, assists, K/D, headshot percentage and damage. MVPs are calculated by EZ Esports. If a result is wrong or a game cannot be fetched, contact EZ Esports staff, who can enter or change it by hand.',
      },
    ],
  },
];

/**
 * Closing step of the full tour only. It is deliberately not part of TOUR_SECTIONS, so
 * the Tutorial menu never lists it and a section replay ends on that section's last
 * real step.
 */
export const CLOSING_STEP: TourStep = {
  id: 'replay',
  anchor: 'tutorial-button',
  title: 'Replay this anytime',
  body: 'Use the Tutorial button to run the full tour again, or pick a single feature to revisit just that part.',
};

export type TourSelection = 'full' | string;

export interface ResolvedTourStep extends TourStep {
  sectionId: string;
  sectionLabel: string;
}

/**
 * Returns the ordered steps for the full tour (sections, then the closing replay step)
 * or one section. Steps whose anchor is
 * not present are dropped rather than shown as dead controls; an unknown section id
 * yields an empty tour.
 */
export function resolveTourSteps(
  selection: TourSelection,
  hasTarget: (anchor: TourAnchor) => boolean,
  sections: TourSection[] = TOUR_SECTIONS,
): ResolvedTourStep[] {
  const resolved = sections
    .filter((section) => selection === 'full' || section.id === selection)
    .flatMap((section) =>
      section.steps
        .filter((step) => hasTarget(step.anchor))
        .map((step) => ({ ...step, sectionId: section.id, sectionLabel: section.label })),
    );

  if (selection === 'full' && hasTarget(CLOSING_STEP.anchor)) {
    resolved.push({ ...CLOSING_STEP, sectionId: 'replay', sectionLabel: 'Replay' });
  }
  return resolved;
}

export function tourAnchorSelector(anchor: TourAnchor): string {
  return `[data-tour="${anchor}"]`;
}
