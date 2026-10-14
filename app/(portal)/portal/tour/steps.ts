/**
 * The single manager-portal tour definition. The first-run tour, the full replay and
 * each per-section replay are all slices of TOUR_SECTIONS; nothing is duplicated.
 *
 * Steps target `data-tour="<anchor>"` attributes only, never classes, selectors or
 * visible text, so restyling or rewording the portal cannot silently break the tour.
 * Anchors sit on containers that always render (including for a brand-new school with
 * no submissions or rosters) or on always-present trigger buttons.
 */

export const TOUR_ANCHORS = [
  'game-tabs',
  'invite-card',
  'invite-history',
  'approvals',
  'rosters',
  'create-roster',
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
    id: 'pick-a-game',
    label: 'Pick a game',
    steps: [
      {
        id: 'game-tabs',
        anchor: 'game-tabs',
        title: 'Start by picking a game',
        body: 'These tabs filter everything below to one game. Choose a game before you invite players, or stay on All Games to see everything at once.',
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
        body: 'Enter the student\u2019s name, choose the game, and generate a single-use link. Share it with that student; they fill in their own details on the link.',
      },
      {
        id: 'invite-history',
        anchor: 'invite-history',
        title: 'Track every invite',
        body: 'Every link you create is listed here with its status, so you can see who has been invited, who has submitted, and copy a link again if it is still open.',
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
        body: 'When a student submits their invite it lands here. Approve or reject it, and pick the roster and role at the same time. Nothing is waiting right now if this queue is empty.',
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
        body: 'Each roster shows its players and a live eligibility check for tournament registration. Add players, change roles, or make an emergency substitution from its card.',
      },
      {
        id: 'create-roster',
        anchor: 'create-roster',
        title: 'Create a roster',
        body: 'Start here if your school has no roster for a game yet. Approved players can then be placed on it.',
      },
    ],
  },
];

export type TourSelection = 'full' | string;

export interface ResolvedTourStep extends TourStep {
  sectionId: string;
  sectionLabel: string;
}

/**
 * Returns the ordered steps for the full tour or one section. Steps whose anchor is
 * not present are dropped rather than shown as dead controls; an unknown section id
 * yields an empty tour.
 */
export function resolveTourSteps(
  selection: TourSelection,
  hasTarget: (anchor: TourAnchor) => boolean,
  sections: TourSection[] = TOUR_SECTIONS,
): ResolvedTourStep[] {
  return sections
    .filter((section) => selection === 'full' || section.id === selection)
    .flatMap((section) =>
      section.steps
        .filter((step) => hasTarget(step.anchor))
        .map((step) => ({ ...step, sectionId: section.id, sectionLabel: section.label })),
    );
}

export function tourAnchorSelector(anchor: TourAnchor): string {
  return `[data-tour="${anchor}"]`;
}
