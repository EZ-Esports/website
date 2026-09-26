export const GAME_REGULATIONS_ROLE = 'Game Regulations Division';

/**
 * Selectable "Primary Role of Interest" choices, in display order. Stored as-is
 * in `staff_applications.role` (a free-text column), so rows submitted before
 * a list change still hold old values (e.g. "Community Moderator",
 * "Other: ...", "VALORANT Division") and admin views render them verbatim.
 */
export const STAFF_ROLES = [
  'Software Engineering Division',
  'Marketing Division',
  'Operations Division',
  'Development Division',
  'Productions Crew',
  'Legal Division',
  GAME_REGULATIONS_ROLE,
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === 'string' && (STAFF_ROLES as readonly string[]).includes(value);
}

/**
 * Follow-up for the Game Regulations Division: an open answer about which
 * game director position(s) the applicant is interested in and their
 * experience with those games. The role column keeps the division name, and
 * this answer lives in `details.gameDirector` as plain text.
 */
export const GAME_DIRECTOR_MAX_LENGTH = 500;

export const GAME_DIRECTOR_REQUIRED_ERROR = 'Please tell us which game director position you are interested in.';
export const GAME_DIRECTOR_TOO_LONG_ERROR = `Your game director answer must be ${GAME_DIRECTOR_MAX_LENGTH} characters or fewer.`;

/** Shared client/server check for the follow-up; returns an error message or null. */
export function checkGameDirectorAnswer(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return GAME_DIRECTOR_REQUIRED_ERROR;
  if (trimmed.length > GAME_DIRECTOR_MAX_LENGTH) return GAME_DIRECTOR_TOO_LONG_ERROR;
  return null;
}

export function requiresGameDirector(role: string): boolean {
  return role === GAME_REGULATIONS_ROLE;
}

export interface StaffApplicationFormData {
  name: string;
  preferredFirstName: string;
  email: string;
  phone: string;
  discordTag: string;
  role: string;
  // Open answer, only meaningful when `role` is the Game Regulations Division.
  gameDirector: string;
  message: string;
  // Optional LinkedIn profile URL, restricted to linkedin.com hosts (see
  // normalizeLinkedInUrl). Resumes are a separate, required PDF attachment
  // stored outside `details` (see staff-resume.ts).
  linkedin: string;
  // Optional free text: links to GitHub, a portfolio, designs, etc.
  workSamples: string;
  availability: string;
  // Split from a single `agreedRules` checkbox into two independently-required
  // consents (issue #107) so an applicant explicitly agrees to each legal
  // document rather than one checkbox bundling both together — mirrors the
  // agreedToTerms/agreedToPrivacy split already shipped for the school form
  // (issue #127, see school-application-form.ts).
  agreedToTerms: boolean;
  agreedToPrivacy: boolean;
  acknowledgedUnpaidVolunteer: boolean;
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

// v3: `linkedin` narrowed to a LinkedIn-only link (the resume moved to a PDF
// attachment in its own column), optional `workSamples` links were added, the
// free-text prompt became "Why do you want to join EZ Esports?" (still stored
// as `backgroundMotivation`), and a third required acknowledgement records
// that the applicant understands the role is part-time, unpaid volunteering.
export interface StaffApplicationDetailsV3 {
  version: 3;
  preferredFirstName: string;
  discordTag: string;
  linkedin: string;
  workSamples: string;
  availability: string;
  consent: {
    agreedToTerms: boolean;
    agreedToPrivacy: boolean;
    acknowledgedUnpaidVolunteer: boolean;
  };
  backgroundMotivation: string;
}

// v4: the three per-game divisions folded into one Game Regulations Division
// with a required open-answer follow-up. `gameDirector` holds that free text
// ('' for every other role); otherwise identical to v3.
export interface StaffApplicationDetailsV4 extends Omit<StaffApplicationDetailsV3, 'version'> {
  version: 4;
  gameDirector: string;
}

export type StaffApplicationDetails =
  | StaffApplicationDetailsV1
  | StaffApplicationDetailsV2
  | StaffApplicationDetailsV3
  | StaffApplicationDetailsV4;

/** Server-side cap on the optional other-links text; generous for several links, small enough to keep `details` compact. */
export const WORK_SAMPLES_MAX_LENGTH = 1000;

/**
 * Cap on the "Why do you want to join EZ Esports?" answer. The prompt asks for
 * about 4-7 sentences (roughly 600-1,000 characters), so 1,500 leaves room for
 * a long answer while keeping `details` bounded.
 */
export const WHY_JOIN_MAX_LENGTH = 1500;

export const WHY_JOIN_REQUIRED_ERROR = 'Please tell us why you want to join EZ Esports.';
export const WHY_JOIN_TOO_LONG_ERROR = `Your answer must be ${WHY_JOIN_MAX_LENGTH.toLocaleString('en-US')} characters or fewer.`;

/** Shared client/server check for the why-join answer; returns an error message or null. */
export function checkWhyJoinAnswer(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return WHY_JOIN_REQUIRED_ERROR;
  if (trimmed.length > WHY_JOIN_MAX_LENGTH) return WHY_JOIN_TOO_LONG_ERROR;
  return null;
}

/** Visible and screen-reader limit notice used in each free-text field's description. */
export function characterLimitNotice(max: number): string {
  return `Up to ${max.toLocaleString('en-US')} characters.`;
}

export const UNPAID_VOLUNTEER_ACK_TEXT =
  'I understand this is currently a part-time, unpaid volunteer position.';

const LINKEDIN_HOST = 'linkedin.com';

/**
 * Normalizes the optional LinkedIn field: blank stays blank, a missing scheme
 * gains `https://`, and the host must be linkedin.com itself or one of its
 * subdomains (www., regional ones such as uk.). Returns null for anything
 * else, including look-alikes such as linkedin.com.evil.example.
 */
export function normalizeLinkedInUrl(value: string): string | null {
  const normalized = normalizeOptionalUrl(value);
  if (!normalized) return normalized;
  const host = new URL(normalized).hostname.toLowerCase();
  return host === LINKEDIN_HOST || host.endsWith(`.${LINKEDIN_HOST}`) ? normalized : null;
}

export const LINKEDIN_URL_ERROR = 'Enter a LinkedIn profile link (linkedin.com/in/…), or leave it blank.';

/**
 * Normalizes an optional link field. Blank stays blank; a bare host such as
 * `linkedin.com/in/jane` gains `https://`; anything that still does not parse
 * as an http(s) URL with a dotted hostname is rejected (returns null).
 */
export function normalizeOptionalUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/\s/.test(trimmed)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!url.hostname.includes('.')) return null;
  return url.toString();
}

export function buildStaffApplicationDetails(form: StaffApplicationFormData): StaffApplicationDetailsV4 {
  return {
    version: 4,
    gameDirector: requiresGameDirector(form.role) ? form.gameDirector.trim() : '',
    preferredFirstName: form.preferredFirstName.trim(),
    discordTag: form.discordTag.trim(),
    linkedin: form.linkedin.trim(),
    workSamples: form.workSamples.trim(),
    availability: form.availability,
    consent: {
      agreedToTerms: !!form.agreedToTerms,
      agreedToPrivacy: !!form.agreedToPrivacy,
      acknowledgedUnpaidVolunteer: !!form.acknowledgedUnpaidVolunteer,
    },
    backgroundMotivation: form.message.trim(),
  };
}

export type ParsedStaffApplicationDetails =
  | { ok: true; details: StaffApplicationDetailsV4 }
  | { ok: false; error: string };

const asString = (v: unknown) => (typeof v === 'string' ? v : '');

/**
 * Server-side gate for the untrusted `details` JSON posted by the public form.
 * Rebuilds a fresh v4 object from known keys only (so stray client fields are
 * never persisted), requires every consent to be strictly `true` (a missing or
 * non-boolean value fails closed rather than passing as truthy), validates the
 * optional LinkedIn URL, and requires a director position exactly when `role`
 * (the already-validated role field) is the Game Regulations Division.
 */
export function parseStaffApplicationDetails(raw: unknown, role: string): ParsedStaffApplicationDetails {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Missing application details.' };
  }
  const d = raw as Record<string, unknown>;
  const consent = (d.consent && typeof d.consent === 'object' ? d.consent : {}) as Record<string, unknown>;

  if (consent.agreedToTerms !== true || consent.agreedToPrivacy !== true) {
    return { ok: false, error: 'You must agree to the Terms of Service and Privacy Policy to submit an application.' };
  }
  if (consent.acknowledgedUnpaidVolunteer !== true) {
    return { ok: false, error: 'You must acknowledge that this is a part-time, unpaid volunteer position.' };
  }

  let gameDirector = '';
  if (requiresGameDirector(role)) {
    const answer = asString(d.gameDirector);
    const problem = checkGameDirectorAnswer(answer);
    if (problem) return { ok: false, error: problem };
    gameDirector = answer.trim();
  }

  const linkedin = normalizeLinkedInUrl(asString(d.linkedin));
  if (linkedin === null) {
    return { ok: false, error: LINKEDIN_URL_ERROR };
  }

  const workSamples = asString(d.workSamples).trim();
  if (workSamples.length > WORK_SAMPLES_MAX_LENGTH) {
    return { ok: false, error: `Other links must be ${WORK_SAMPLES_MAX_LENGTH} characters or fewer.` };
  }

  const backgroundMotivationRaw = asString(d.backgroundMotivation);
  const whyJoinError = checkWhyJoinAnswer(backgroundMotivationRaw);
  if (whyJoinError) return { ok: false, error: whyJoinError };
  const backgroundMotivation = backgroundMotivationRaw.trim();

  return {
    ok: true,
    details: {
      version: 4,
      gameDirector,
      preferredFirstName: asString(d.preferredFirstName).trim(),
      discordTag: asString(d.discordTag).trim(),
      linkedin,
      workSamples,
      availability: asString(d.availability),
      consent: { agreedToTerms: true, agreedToPrivacy: true, acknowledgedUnpaidVolunteer: true },
      backgroundMotivation,
    },
  };
}

const UNKNOWN_SHAPE_ROW = [{ label: 'Details', value: 'Could not display — unexpected data shape.' }];

/** Dispatches on `version` rather than trusting the shape, so a row with an unrecognized version degrades to a message instead of rendering garbage — see the school-application-form.ts counterpart. */
export function formatStaffApplicationDetails(d: StaffApplicationDetails): { label: string; value: string }[] {
  switch (d?.version) {
    case 4: return formatStaffApplicationDetailsV4(d);
    case 3: return formatStaffApplicationDetailsV3(d);
    case 2: return formatStaffApplicationDetailsV2(d);
    case 1: return formatStaffApplicationDetailsV1(d);
    default: return UNKNOWN_SHAPE_ROW;
  }
}

const agreed = (v: boolean | undefined) => (v ? 'Agreed' : 'Disagreed');

// v1 and v2 keep the "LinkedIn / Portfolio" label: those applicants answered a
// question that also invited portfolio and resume links, so the stored value
// may not be a LinkedIn URL at all.
function formatStaffApplicationDetailsV1(d: StaffApplicationDetailsV1): { label: string; value: string }[] {
  return [
    { label: 'LinkedIn / Portfolio', value: d.linkedin || '—' },
    { label: 'Weekly Availability', value: d.availability || '—' },
    { label: 'Rules Agreement', value: d.agreedRules ? 'Agreed' : 'Disagreed' },
    { label: 'Background & Motivation', value: d.backgroundMotivation || '—' },
  ];
}

function formatStaffApplicationDetailsV2(d: StaffApplicationDetailsV2): { label: string; value: string }[] {
  return [
    { label: 'LinkedIn / Portfolio', value: d.linkedin || '—' },
    { label: 'Weekly Availability', value: d.availability || '—' },
    { label: 'Terms of Service', value: agreed(d.consent?.agreedToTerms) },
    { label: 'Privacy Policy', value: agreed(d.consent?.agreedToPrivacy) },
    { label: 'Background & Motivation', value: d.backgroundMotivation || '—' },
  ];
}

function formatStaffApplicationDetailsV4(d: StaffApplicationDetailsV4): { label: string; value: string }[] {
  const rows = formatStaffApplicationDetailsV3({ ...d, version: 3 });
  // Plain text: admin renders it as a text node and the CSV writer escapes it.
  return d.gameDirector ? [{ label: 'Game Director Interest', value: d.gameDirector }, ...rows] : rows;
}

function formatStaffApplicationDetailsV3(d: StaffApplicationDetailsV3): { label: string; value: string }[] {
  return [
    { label: 'LinkedIn', value: d.linkedin || '—' },
    { label: 'Other Links', value: d.workSamples || '—' },
    { label: 'Weekly Availability', value: d.availability || '—' },
    { label: 'Terms of Service', value: agreed(d.consent?.agreedToTerms) },
    { label: 'Privacy Policy', value: agreed(d.consent?.agreedToPrivacy) },
    {
      label: 'Unpaid Volunteer Role',
      value: d.consent?.acknowledgedUnpaidVolunteer ? 'Acknowledged' : 'Not acknowledged',
    },
    { label: 'Why EZ Esports', value: d.backgroundMotivation || '—' },
  ];
}
