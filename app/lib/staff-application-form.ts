export interface StaffApplicationFormData {
  name: string;
  preferredFirstName: string;
  email: string;
  phone: string;
  discordTag: string;
  role: string;
  roleOther: string;
  message: string;
  linkedin: string;
  availability: string;
  agreedRules: boolean;
}

// See the SchoolApplicationDetails union in school-application-form.ts for why this
// is versioned rather than a single fixed shape — only one staff form shape has ever
// existed so far, but the next redesign becomes a new union member, not a migration.
export interface StaffApplicationDetailsV1 {
  version: 1;
  preferredFirstName: string;
  discordTag: string;
  linkedin: string;
  availability: string;
  agreedRules: boolean;
}

export type StaffApplicationDetails = StaffApplicationDetailsV1;

export function buildStaffApplicationDetails(form: StaffApplicationFormData): StaffApplicationDetailsV1 {
  return {
    version: 1,
    preferredFirstName: form.preferredFirstName.trim(),
    discordTag: form.discordTag.trim(),
    linkedin: form.linkedin.trim(),
    availability: form.availability,
    agreedRules: !!form.agreedRules,
  };
}

const UNKNOWN_SHAPE_ROW = [{ label: 'Details', value: 'Could not display — unexpected data shape.' }];

/** Dispatches on `version` rather than trusting the shape, so a row with an unrecognized version degrades to a message instead of rendering garbage — see the school-application-form.ts counterpart. */
export function formatStaffApplicationDetails(d: StaffApplicationDetails): { label: string; value: string }[] {
  switch (d?.version) {
    case 1: return formatStaffApplicationDetailsV1(d);
    default: return UNKNOWN_SHAPE_ROW;
  }
}

function formatStaffApplicationDetailsV1(d: StaffApplicationDetailsV1): { label: string; value: string }[] {
  return [
    { label: 'LinkedIn / Portfolio', value: d.linkedin || '—' },
    { label: 'Weekly Availability', value: d.availability || '—' },
    { label: 'Rules Agreement', value: d.agreedRules ? 'Agreed' : 'Disagreed' },
  ];
}

// Matches the exact template StaffApplyForm.tsx has always compiled into `message`.
// Used only by db/backfill-application-details.ts — see the school-application-form.ts
// counterpart for why this is a full-string match rather than a per-line scrape.
const STAFF_MESSAGE_PATTERN_V1 = new RegExp(
  '^Preferred first name: (?<preferredFirstName>.*)\\n' +
  'Phone number: (?<phone>.*)\\n' +
  'Discord tag: (?<discordTag>.*)\\n' +
  'LinkedIn / Portfolio: (?<linkedin>.*)\\n' +
  'Weekly availability: (?<availability>.*)\\n\\n' +
  'Background & Motivation:\\n' +
  '(?<background>[\\s\\S]*)$'
);

/** `form.field || 'N/A'` was the compile-time placeholder for an empty field — undo it so a backfilled row looks the same as one built fresh from an empty field. */
function undoPlaceholder(value: string): string {
  return value.trim() === 'N/A' ? '' : value.trim();
}

/**
 * Reconstructs `StaffApplicationDetails` from a legacy `message` blob for
 * db/backfill-application-details.ts, or `null` if it doesn't match any known
 * template. `agreedRules` isn't present in the compiled message at all (the form
 * never wrote it there) — defaulted to `true` here because the submit handler has
 * always required the checkbox before a row could exist.
 */
export function parseStaffApplicationMessage(message: string): StaffApplicationDetails | null {
  const match = STAFF_MESSAGE_PATTERN_V1.exec(message.trim());
  if (!match?.groups) return null;
  const g = match.groups;

  return {
    version: 1,
    preferredFirstName: undoPlaceholder(g.preferredFirstName),
    discordTag: undoPlaceholder(g.discordTag),
    linkedin: undoPlaceholder(g.linkedin),
    availability: g.availability.trim(),
    agreedRules: true,
  };
}
