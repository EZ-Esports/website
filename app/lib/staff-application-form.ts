/**
 * Selectable "Primary Role of Interest" choices, in display order. Stored as-is
 * in `staff_applications.role` (a free-text column), so rows submitted before
 * the divisions change still hold old values (e.g. "Community Moderator",
 * "Other: ...") and admin views render them verbatim.
 */
export const STAFF_ROLES = [
  'Software Engineering Division',
  'Marketing Division',
  'Operations Division',
  'Development Division',
  'Productions Crew',
  'Legal Division',
  'VALORANT Division',
  'League of Legends Division',
  'Teamfight Tactics Division',
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === 'string' && (STAFF_ROLES as readonly string[]).includes(value);
}

export interface StaffApplicationFormData {
  name: string;
  preferredFirstName: string;
  email: string;
  phone: string;
  discordTag: string;
  role: string;
  message: string;
  linkedin: string;
  availability: string;
  // Split from a single `agreedRules` checkbox into two independently-required
  // consents (issue #107) so an applicant explicitly agrees to each legal
  // document rather than one checkbox bundling both together — mirrors the
  // agreedToTerms/agreedToPrivacy split already shipped for the school form
  // (issue #127, see school-application-form.ts).
  agreedToTerms: boolean;
  agreedToPrivacy: boolean;
}

// See the SchoolApplicationDetails union in school-application-form.ts for why this
// is versioned rather than a single fixed shape — a form redesign becomes a new
// union member, not a migration of old rows.
export interface StaffApplicationDetailsV1 {
  version: 1;
  preferredFirstName: string;
  discordTag: string;
  linkedin: string;
  availability: string;
  agreedRules: boolean;
  // The free-text "Background & Motivation" answer (form field `message` on
  // StaffApplicationFormData — an unrelated, confusingly-named field, not the
  // DB `message` column/blob). Previously this answer only ever made it into
  // the compiled `message` blob; now that new submissions stop writing that
  // blob, it has to live in `details` or it would be silently lost.
  backgroundMotivation: string;
}

// v2 (issue #107): the single `agreedRules` boolean became two
// independently-tracked consents (Terms of Service, Privacy Policy) — a new
// version rather than reshaping v1's field, per the versioning rule
// documented above.
export interface StaffApplicationDetailsV2 {
  version: 2;
  preferredFirstName: string;
  discordTag: string;
  linkedin: string;
  availability: string;
  consent: {
    agreedToTerms: boolean;
    agreedToPrivacy: boolean;
  };
  backgroundMotivation: string;
}

export type StaffApplicationDetails = StaffApplicationDetailsV1 | StaffApplicationDetailsV2;

export function buildStaffApplicationDetails(form: StaffApplicationFormData): StaffApplicationDetailsV2 {
  return {
    version: 2,
    preferredFirstName: form.preferredFirstName.trim(),
    discordTag: form.discordTag.trim(),
    linkedin: form.linkedin.trim(),
    availability: form.availability,
    consent: {
      agreedToTerms: !!form.agreedToTerms,
      agreedToPrivacy: !!form.agreedToPrivacy,
    },
    backgroundMotivation: form.message.trim(),
  };
}

const UNKNOWN_SHAPE_ROW = [{ label: 'Details', value: 'Could not display — unexpected data shape.' }];

/** Dispatches on `version` rather than trusting the shape, so a row with an unrecognized version degrades to a message instead of rendering garbage — see the school-application-form.ts counterpart. */
export function formatStaffApplicationDetails(d: StaffApplicationDetails): { label: string; value: string }[] {
  switch (d?.version) {
    case 2: return formatStaffApplicationDetailsV2(d);
    case 1: return formatStaffApplicationDetailsV1(d);
    default: return UNKNOWN_SHAPE_ROW;
  }
}

function formatStaffApplicationDetailsV1(d: StaffApplicationDetailsV1): { label: string; value: string }[] {
  return [
    { label: 'LinkedIn / Portfolio', value: d.linkedin || '—' },
    { label: 'Weekly Availability', value: d.availability || '—' },
    { label: 'Rules Agreement', value: d.agreedRules ? 'Agreed' : 'Disagreed' },
    { label: 'Background & Motivation', value: d.backgroundMotivation || '—' },
  ];
}

function formatStaffApplicationDetailsV2(d: StaffApplicationDetailsV2): { label: string; value: string }[] {
  const agreed = (v: boolean) => (v ? 'Agreed' : 'Disagreed');
  return [
    { label: 'LinkedIn / Portfolio', value: d.linkedin || '—' },
    { label: 'Weekly Availability', value: d.availability || '—' },
    { label: 'Terms of Service', value: agreed(d.consent?.agreedToTerms) },
    { label: 'Privacy Policy', value: agreed(d.consent?.agreedToPrivacy) },
    { label: 'Background & Motivation', value: d.backgroundMotivation || '—' },
  ];
}
