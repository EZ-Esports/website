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
  // The free-text "Background & Motivation" answer (form field `message` on
  // StaffApplicationFormData — an unrelated, confusingly-named field, not the
  // DB `message` column/blob). Previously this answer only ever made it into
  // the compiled `message` blob; now that new submissions stop writing that
  // blob, it has to live in `details` or it would be silently lost.
  backgroundMotivation: string;
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
    backgroundMotivation: form.message.trim(),
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
    { label: 'Background & Motivation', value: d.backgroundMotivation || '—' },
  ];
}
