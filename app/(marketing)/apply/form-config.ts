import {
  GAME_LABELS,
  CLUB_BARRIER_LABELS,
  NON_ROSTER_OPPORTUNITY_LABELS,
  INCLUSIVE_OPPORTUNITY_LABELS,
  CONTRIBUTE_BEYOND_SCHOOL_LABELS,
} from '@/app/lib/school-application-form';

export const GRAD_YEARS = ["'27", "'28", "'29", "'30"] as const;

export const CLUB_STATUS_OPTIONS = [
  'Active and returning',
  'Rebuilding leadership',
  'Newly forming',
  'Unsure',
  'Currently inactive',
] as const;

export const ADVISOR_CONFIRMED_OPTIONS = ['Yes', 'Pending / in-progress', 'Not yet identified'] as const;

// Single source of truth tying each checkbox-group form field to its label
// map (and whether it has a write-in "Other" option), so the option key type
// below can't drift from what's actually rendered.
export const CHECKBOX_GROUP_LABELS = {
  interestedGames: { labels: GAME_LABELS, hasOther: true },
  nonRosterOpportunities: { labels: NON_ROSTER_OPPORTUNITY_LABELS, hasOther: true },
  inclusiveOpportunities: { labels: INCLUSIVE_OPPORTUNITY_LABELS, hasOther: true },
  contributeBeyondSchool: { labels: CONTRIBUTE_BEYOND_SCHOOL_LABELS, hasOther: false },
} as const;

// Object.entries() widens keys to `string`; this recovers the literal key
// union so checkbox option ids stay typo-checked at their call sites.
function typedEntries<T extends Record<string, string>>(labels: T): [keyof T & string, string][] {
  return Object.entries(labels) as [keyof T & string, string][];
}

// Hoisted so these static label maps are only ever iterated once (at module
// load) instead of being re-derived on every keystroke/render.
export const GAME_ENTRIES = typedEntries(GAME_LABELS);
export const NON_ROSTER_OPPORTUNITY_ENTRIES = typedEntries(NON_ROSTER_OPPORTUNITY_LABELS);
export const INCLUSIVE_OPPORTUNITY_ENTRIES = typedEntries(INCLUSIVE_OPPORTUNITY_LABELS);
export const CONTRIBUTE_BEYOND_SCHOOL_ENTRIES = typedEntries(CONTRIBUTE_BEYOND_SCHOOL_LABELS);
// CLUB_BARRIER_LABELS is typed as `Record<string, string>` (not literal-keyed,
// see its definition), so it can't go through typedEntries — but it's just as
// static, so it's hoisted the same way to avoid re-deriving it every render.
export const CLUB_BARRIER_ENTRIES = Object.entries(CLUB_BARRIER_LABELS);

// Derives an all-unchecked selection map from a *_LABELS export so the initial
// state can never drift out of sync with the options actually rendered.
export function emptySelection(labels: Record<string, string>, hasOther: boolean): Record<string, boolean> {
  const selection: Record<string, boolean> = {};
  for (const key of Object.keys(labels)) selection[key] = false;
  if (hasOther) selection.other = false;
  return selection;
}

// A checkbox group is "complete" once at least one option is checked, and —
// if the checked options include the write-in "Other" toggle — the write-in
// text isn't blank. Shared by the progress/required-field checks below so
// the completeness rule can't drift between checkbox groups.
export function isCheckboxGroupComplete(selection: Record<string, boolean>, otherText?: string): boolean {
  return Object.values(selection).some(Boolean) && (!selection.other || !!otherText?.trim());
}

export type CheckboxGroupKey = keyof typeof CHECKBOX_GROUP_LABELS;
// 'other' is only a valid key for groups whose config sets hasOther: true —
// this stays in sync with CHECKBOX_GROUP_LABELS instead of being available
// (and silently unused) on every group regardless of whether it renders an
// "Other:" write-in row.
export type CheckboxOptionKey<G extends CheckboxGroupKey> =
  | (keyof (typeof CHECKBOX_GROUP_LABELS)[G]['labels'] & string)
  | ((typeof CHECKBOX_GROUP_LABELS)[G]['hasOther'] extends true ? 'other' : never);

export const SECTIONS = [
  { id: 'president', num: 1, title: 'President Info', desc: 'Primary student leader contact and school details.' },
  { id: 'vicePresident', num: 2, title: 'Vice President Info', desc: 'Co-president, VP, or primary club manager.' },
  { id: 'thirdOfficer', num: 3, title: '3rd Student Officer Info', desc: 'Third student point of contact.' },
  { id: 'clubInfo', num: 4, title: 'Club Info', desc: 'Socials, advisor details, active members & games.' },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];
