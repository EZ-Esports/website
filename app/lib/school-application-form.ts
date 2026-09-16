export interface SchoolApplicationFormData {
  clubStatus: string;

  presidentFirstName: string;
  presidentLastName: string;
  schoolName: string;
  presidentGradYear: string;
  presidentEmail: string;
  presidentDiscord: string;
  presidentPreferredContact: string;

  vpFirstName: string;
  vpLastName: string;
  vpGradYear: string;
  vpDiscord: string;
  vpEmail: string;
  vpPreferredContact: string;

  officerFirstName: string;
  officerLastName: string;
  officerGradYear: string;
  officerEmail: string;
  officerPreferredContact: string;

  instagramLink: string;
  discordLink: string;
  advisorName: string;
  advisorEmail: string;
  advisorConfirmed: string;
  activeStudentsCount: string;
  interestedGames: Record<string, boolean>;
  interestedGamesOther?: string;
  clubBarriers: string;
  clubBarriersOther?: string;
  nonRosterOpportunities: Record<string, boolean>;
  nonRosterOpportunitiesOther?: string;
  inclusiveOpportunities: Record<string, boolean>;
  inclusiveOpportunitiesOther?: string;
  separateGamingClubs: string;
  contributeBeyondSchool: Record<string, boolean>;
  feedback?: string;
  // Split from a single `agreedRules` checkbox into three independently-required
  // consents (issue #127) so an applicant explicitly agrees to each legal
  // document rather than one checkbox bundling rules + terms + privacy together.
  agreedToRules: boolean;
  agreedToTerms: boolean;
  agreedToPrivacy: boolean;
}

// `satisfies` (rather than an explicit `: Record<string, string>` annotation)
// keeps each object's keys literal so `typedEntries`/`CheckboxOptionKey` in
// ApplyForm.tsx can actually typo-check checkbox option ids against these
// keys — a `Record<string, string>` annotation would widen the keys to
// `string` and silently defeat that check.
export const GAME_LABELS = {
  valorant: 'Valorant',
  lol: 'League of Legends (LoL)',
  tft: 'Teamfight Tactics (TFT)',
  tetris: 'TETR.IO',
  clashRoyale: 'Clash Royale',
  smashBros: 'Super Smash Bros. Ultimate',
} satisfies Record<string, string>;

// Kept as `Record<string, string>` (not `satisfies`) because it's indexed
// below with a plain `string` (`form.clubBarriers`), which requires an index
// signature rather than literal keys.
export const CLUB_BARRIER_LABELS: Record<string, string> = {
  recruitingPlayers: 'Recruiting players',
  facultySupport: 'Faculty support',
  limitedExperience: 'Limited experience',
};

export const NON_ROSTER_OPPORTUNITY_LABELS = {
  oneDayTournaments: 'One-day open tournaments',
  castingProduction: 'Casting or production',
  contentDesign: 'Content and design',
  eventOperations: 'Event operations',
  workshopsCareerPanels: 'Workshops or career panels',
} satisfies Record<string, string>;

export const INCLUSIVE_OPPORTUNITY_LABELS = {
  developmentalJV: 'Developmental or JV competition',
  openTournaments: 'Open, one-day tournaments',
  friendlyScrimmages: 'Friendly scrimmages',
  castingObserving: 'Casting, observing, or broadcast production',
  coachingStrategy: 'Coaching, strategy, or analytics',
  contentCreation: 'Content creation, design, or event operations',
  workshopsCommunity: 'Workshops or community events',
} satisfies Record<string, string>;

export const CONTRIBUTE_BEYOND_SCHOOL_LABELS = {
  gameRules: 'Collaborating and advising on game rules, formats, or scheduling',
  broadcasts: 'Helping with broadcasts, casting, or production',
  communityEvents: 'Supporting community events or one-off tournaments',
  welcomingSchools: 'Welcoming and supporting new schools',
  marketingPartnerships: 'Contributing to marketing, partnerships, or software and technical development',
  leadersCouncil: 'Representing our high school on an EZ Esports Club Leaders Council',
  notAtThisTime: 'Not at this time',
} satisfies Record<string, string>;

export function validateSchoolApplicationForm(form: SchoolApplicationFormData) {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const errors: Record<string, string> = {};

  if (!form.clubStatus) errors.clubStatus = "Please select your club's current status.";

  // Layer 1
  if (!form.presidentFirstName.trim()) errors.presidentFirstName = "President first name is required.";
  if (!form.presidentLastName.trim()) errors.presidentLastName = "President last name is required.";
  if (!form.schoolName.trim()) errors.schoolName = "School name is required.";
  if (!form.presidentGradYear) errors.presidentGradYear = "Please select a graduation year.";
  if (!form.presidentEmail.trim()) errors.presidentEmail = "President email is required.";
  else if (!EMAIL_RE.test(form.presidentEmail)) errors.presidentEmail = "Enter a valid email address.";
  if (!form.presidentDiscord.trim()) errors.presidentDiscord = "Discord username is required.";
  if (!form.presidentPreferredContact.trim()) errors.presidentPreferredContact = "Please specify best contact platform.";

  // Layer 2
  if (!form.vpFirstName.trim()) errors.vpFirstName = "Vice President first name is required.";
  if (!form.vpLastName.trim()) errors.vpLastName = "Vice President last name is required.";
  if (!form.vpGradYear) errors.vpGradYear = "Please select a graduation year.";
  if (!form.vpDiscord.trim()) errors.vpDiscord = "Discord username is required.";
  if (!form.vpEmail.trim()) errors.vpEmail = "Vice President email is required.";
  else if (!EMAIL_RE.test(form.vpEmail)) errors.vpEmail = "Enter a valid email address.";
  if (!form.vpPreferredContact.trim()) errors.vpPreferredContact = "Please specify best contact platform.";

  // Layer 3
  if (!form.officerFirstName.trim()) errors.officerFirstName = "Officer first name is required.";
  if (!form.officerLastName.trim()) errors.officerLastName = "Officer last name is required.";
  if (!form.officerGradYear) errors.officerGradYear = "Please select a graduation year.";
  if (!form.officerEmail.trim()) errors.officerEmail = "Officer email is required.";
  else if (!EMAIL_RE.test(form.officerEmail)) errors.officerEmail = "Enter a valid email address.";
  if (!form.officerPreferredContact.trim()) errors.officerPreferredContact = "Please specify best contact platform.";

  // Layer 4
  if (!form.instagramLink.trim()) errors.instagramLink = "Club's Instagram link is required.";
  if (!form.discordLink.trim()) errors.discordLink = "Club's Discord link is required.";
  if (!form.advisorName.trim()) errors.advisorName = "Club advisor name is required.";
  if (!form.advisorEmail.trim()) errors.advisorEmail = "Club advisor email is required.";
  else if (!EMAIL_RE.test(form.advisorEmail)) errors.advisorEmail = "Enter a valid email address.";
  if (!form.advisorConfirmed) errors.advisorConfirmed = "Please let us know if your faculty advisor is confirmed.";
  if (!form.activeStudentsCount.trim()) errors.activeStudentsCount = "Estimated student count is required.";

  const hasGame = Object.values(form.interestedGames).some(Boolean);
  if (!hasGame) {
    errors.interestedGames = "Select at least one game your club is interested in.";
  } else if (form.interestedGames.other && !form.interestedGamesOther?.trim()) {
    errors.interestedGamesOther = "Please specify the other game.";
  }

  if (!form.clubBarriers) {
    errors.clubBarriers = "Please select your club's biggest barrier.";
  } else if (form.clubBarriers === 'other' && !form.clubBarriersOther?.trim()) {
    errors.clubBarriersOther = "Please specify the barrier.";
  }

  const hasNonRosterOpportunity = Object.values(form.nonRosterOpportunities).some(Boolean);
  if (!hasNonRosterOpportunity) {
    errors.nonRosterOpportunities = "Select at least one opportunity.";
  } else if (form.nonRosterOpportunities.other && !form.nonRosterOpportunitiesOther?.trim()) {
    errors.nonRosterOpportunitiesOther = "Please specify the other opportunity.";
  }

  const hasInclusiveOpportunity = Object.values(form.inclusiveOpportunities).some(Boolean);
  if (!hasInclusiveOpportunity) {
    errors.inclusiveOpportunities = "Select at least one option.";
  } else if (form.inclusiveOpportunities.other && !form.inclusiveOpportunitiesOther?.trim()) {
    errors.inclusiveOpportunitiesOther = "Please specify the other option.";
  }

  if (!form.separateGamingClubs.trim()) {
    errors.separateGamingClubs = "This field is required — write \"N/A\" if it doesn't apply.";
  }

  const hasContribution = Object.values(form.contributeBeyondSchool).some(Boolean);
  if (!hasContribution) {
    errors.contributeBeyondSchool = "Select at least one option.";
  }

  if (!form.agreedToRules) {
    errors.agreedToRules = "You must agree to the EZ Esports league rules & code of conduct.";
  }
  if (!form.agreedToTerms) {
    errors.agreedToTerms = "You must agree to the Terms of Service.";
  }
  if (!form.agreedToPrivacy) {
    errors.agreedToPrivacy = "You must agree to the Privacy Policy / data handling terms.";
  }

  return errors;
}

// The application form has been fully restructured at least once already (the
// "v1" shape below predates the 4-layer club-officer form entirely — school
// code, a single captains/coaches blob, no VP/officer contacts). Rather than
// force every future redesign through a single fixed shape — coercing old
// rows into it (lossy) or leaving them permanently unparseable (what v1 rows
// were before this) — `details` is a discriminated union tagged by
// `version`. Each version keeps its own shape and its own formatter forever
// (old rows are immutable and must stay renderable); a new form redesign is
// a new union member plus a version bump, never a migration of old rows.
export interface SchoolApplicationDetailsV1 {
  version: 1;
  preferredFirstName: string;
  phone: string;
  discordTag: string;
  schoolCode: string;
  schoolLocation: string;
  howHeard: string;
  linkedin: string;
  captainsCoaches: string;
  teamNotes: string;
  needHelpFindingPlayers: string;
  preferredCommunicationPlatform: string;
  interestedDivisions: string;
  agreedRules: boolean;
  additionalNotes: string;
}

export interface SchoolApplicationDetailsV2 {
  version: 2;
  clubStatus: string;
  president: { firstName: string; lastName: string; gradYear: string; email: string; discord: string; preferredContact: string };
  vicePresident: { firstName: string; lastName: string; gradYear: string; discord: string; email: string; preferredContact: string };
  thirdOfficer: { firstName: string; lastName: string; gradYear: string; email: string; preferredContact: string };
  club: {
    instagramLink: string;
    discordLink: string;
    advisorName: string;
    advisorEmail: string;
    advisorConfirmed: string;
    activeStudentsCount: string;
    interestedGames: string[];
    clubBarrier: string;
    nonRosterOpportunities: string[];
    inclusiveOpportunities: string[];
    separateGamingClubs: string;
    contributeBeyondSchool: string[];
  };
  feedback: string;
  agreedRules: boolean;
}

// v3: the single `agreedRules` boolean became three independently-tracked
// consents (issue #127) — a new version rather than reshaping v2's field, per
// the versioning rule documented above.
export interface SchoolApplicationDetailsV3 {
  version: 3;
  clubStatus: string;
  president: { firstName: string; lastName: string; gradYear: string; email: string; discord: string; preferredContact: string };
  vicePresident: { firstName: string; lastName: string; gradYear: string; discord: string; email: string; preferredContact: string };
  thirdOfficer: { firstName: string; lastName: string; gradYear: string; email: string; preferredContact: string };
  club: {
    instagramLink: string;
    discordLink: string;
    advisorName: string;
    advisorEmail: string;
    advisorConfirmed: string;
    activeStudentsCount: string;
    interestedGames: string[];
    clubBarrier: string;
    nonRosterOpportunities: string[];
    inclusiveOpportunities: string[];
    separateGamingClubs: string;
    contributeBeyondSchool: string[];
  };
  feedback: string;
  consent: {
    agreedToRules: boolean;
    agreedToTerms: boolean;
    agreedToPrivacy: boolean;
  };
}

export type SchoolApplicationDetails = SchoolApplicationDetailsV1 | SchoolApplicationDetailsV2 | SchoolApplicationDetailsV3;

function selectedLabels(selection: Record<string, boolean>, labels: Record<string, string>, otherText?: string): string[] {
  const result = Object.keys(labels)
    .filter((key) => selection[key])
    .map((key) => labels[key]);
  if (selection.other && otherText) {
    result.push(`Other: ${otherText.trim()}`);
  }
  return result;
}

/**
 * Builds the payload posted to /api/apply. This used to also compile a
 * formatted `message` text blob duplicating everything in `details` (kept in
 * sync historically via regex parsers that reverse-parsed `message` back into
 * `details` for a one-off backfill — see issue #166). The DB `message` column
 * still exists and is still read as a fallback for legacy rows whose
 * `details` predates this column, but new submissions no longer populate it —
 * `details` is now the sole source of truth going forward.
 */
export function compileApplicationPayload(form: SchoolApplicationFormData) {
  return {
    applicantName: `${form.presidentFirstName.trim()} ${form.presidentLastName.trim()}`,
    schoolName: form.schoolName.trim(),
    role: "Esports Club President",
    email: form.presidentEmail.trim(),
    details: buildSchoolApplicationDetails(form),
  };
}

export function buildSchoolApplicationDetails(form: SchoolApplicationFormData): SchoolApplicationDetailsV3 {
  const barrierLabel =
    form.clubBarriers === 'other'
      ? `Other: ${form.clubBarriersOther?.trim() ?? ''}`
      : CLUB_BARRIER_LABELS[form.clubBarriers] ?? form.clubBarriers;

  return {
    version: 3,
    clubStatus: form.clubStatus,
    president: {
      firstName: form.presidentFirstName.trim(),
      lastName: form.presidentLastName.trim(),
      gradYear: form.presidentGradYear,
      email: form.presidentEmail.trim(),
      discord: form.presidentDiscord.trim(),
      preferredContact: form.presidentPreferredContact.trim(),
    },
    vicePresident: {
      firstName: form.vpFirstName.trim(),
      lastName: form.vpLastName.trim(),
      gradYear: form.vpGradYear,
      discord: form.vpDiscord.trim(),
      email: form.vpEmail.trim(),
      preferredContact: form.vpPreferredContact.trim(),
    },
    thirdOfficer: {
      firstName: form.officerFirstName.trim(),
      lastName: form.officerLastName.trim(),
      gradYear: form.officerGradYear,
      email: form.officerEmail.trim(),
      preferredContact: form.officerPreferredContact.trim(),
    },
    club: {
      instagramLink: form.instagramLink.trim(),
      discordLink: form.discordLink.trim(),
      advisorName: form.advisorName.trim(),
      advisorEmail: form.advisorEmail.trim(),
      advisorConfirmed: form.advisorConfirmed,
      activeStudentsCount: form.activeStudentsCount.trim(),
      interestedGames: selectedLabels(form.interestedGames, GAME_LABELS, form.interestedGamesOther),
      clubBarrier: barrierLabel,
      nonRosterOpportunities: selectedLabels(form.nonRosterOpportunities, NON_ROSTER_OPPORTUNITY_LABELS, form.nonRosterOpportunitiesOther),
      inclusiveOpportunities: selectedLabels(form.inclusiveOpportunities, INCLUSIVE_OPPORTUNITY_LABELS, form.inclusiveOpportunitiesOther),
      separateGamingClubs: form.separateGamingClubs.trim(),
      contributeBeyondSchool: selectedLabels(form.contributeBeyondSchool, CONTRIBUTE_BEYOND_SCHOOL_LABELS),
    },
    feedback: form.feedback?.trim() ?? '',
    consent: {
      agreedToRules: !!form.agreedToRules,
      agreedToTerms: !!form.agreedToTerms,
      agreedToPrivacy: !!form.agreedToPrivacy,
    },
  };
}

const UNKNOWN_SHAPE_ROW = [{ label: 'Details', value: 'Could not display — unexpected data shape.' }];

/** `details` comes straight off a public, unauthenticated POST body — dispatching on `version` (rather than trusting the shape) means a row with an unrecognized or missing version, or one whose write-time guard only checked `object && !Array.isArray`, degrades to a message instead of throwing when a staff member expands it. */
export function formatSchoolApplicationDetails(d: SchoolApplicationDetails): { label: string; value: string }[] {
  switch (d?.version) {
    case 3: return formatSchoolApplicationDetailsV3(d);
    case 2: return formatSchoolApplicationDetailsV2(d);
    case 1: return formatSchoolApplicationDetailsV1(d);
    default: return UNKNOWN_SHAPE_ROW;
  }
}

function formatSchoolApplicationDetailsV3(d: SchoolApplicationDetailsV3): { label: string; value: string }[] {
  if (!d.president || !d.vicePresident || !d.thirdOfficer || !d.club || !d.consent) {
    return UNKNOWN_SHAPE_ROW;
  }

  const list = (value: unknown) => (Array.isArray(value) ? value.join(', ') : String(value ?? '')) || '—';
  const agreed = (v: boolean) => (v ? 'Agreed' : 'Disagreed');

  return [
    { label: 'Club Status', value: d.clubStatus },
    { label: 'President', value: `${d.president.firstName} ${d.president.lastName} — ${d.president.email}, ${d.president.discord}, grad ${d.president.gradYear} (prefers ${d.president.preferredContact})` },
    { label: 'Vice President', value: `${d.vicePresident.firstName} ${d.vicePresident.lastName} — ${d.vicePresident.email}, ${d.vicePresident.discord}, grad ${d.vicePresident.gradYear} (prefers ${d.vicePresident.preferredContact})` },
    { label: '3rd Club Officer', value: `${d.thirdOfficer.firstName} ${d.thirdOfficer.lastName} — ${d.thirdOfficer.email}, grad ${d.thirdOfficer.gradYear} (prefers ${d.thirdOfficer.preferredContact})` },
    { label: 'Instagram', value: d.club.instagramLink || '—' },
    { label: 'Discord', value: d.club.discordLink || '—' },
    { label: 'Faculty Advisor', value: `${d.club.advisorName} (${d.club.advisorEmail}) — ${d.club.advisorConfirmed}` },
    { label: 'Active Club Members', value: d.club.activeStudentsCount },
    { label: 'Interested Games', value: list(d.club.interestedGames) },
    { label: 'Biggest Barrier', value: d.club.clubBarrier },
    { label: 'Non-Roster Opportunities', value: list(d.club.nonRosterOpportunities) },
    { label: 'Inclusive Opportunities', value: list(d.club.inclusiveOpportunities) },
    { label: 'Separate Gaming Clubs/Groups', value: d.club.separateGamingClubs },
    { label: 'Contribute Beyond School', value: list(d.club.contributeBeyondSchool) },
    { label: 'Feedback', value: d.feedback || '—' },
    { label: 'League Rules & Code of Conduct', value: agreed(d.consent.agreedToRules) },
    { label: 'Terms of Service', value: agreed(d.consent.agreedToTerms) },
    { label: 'Privacy & Data Handling', value: agreed(d.consent.agreedToPrivacy) },
  ];
}

function formatSchoolApplicationDetailsV2(d: SchoolApplicationDetailsV2): { label: string; value: string }[] {
  if (!d.president || !d.vicePresident || !d.thirdOfficer || !d.club || typeof d.agreedRules !== 'boolean') {
    return UNKNOWN_SHAPE_ROW;
  }

  const list = (value: unknown) => (Array.isArray(value) ? value.join(', ') : String(value ?? '')) || '—';

  return [
    { label: 'Club Status', value: d.clubStatus },
    { label: 'President', value: `${d.president.firstName} ${d.president.lastName} — ${d.president.email}, ${d.president.discord}, grad ${d.president.gradYear} (prefers ${d.president.preferredContact})` },
    { label: 'Vice President', value: `${d.vicePresident.firstName} ${d.vicePresident.lastName} — ${d.vicePresident.email}, ${d.vicePresident.discord}, grad ${d.vicePresident.gradYear} (prefers ${d.vicePresident.preferredContact})` },
    { label: '3rd Club Officer', value: `${d.thirdOfficer.firstName} ${d.thirdOfficer.lastName} — ${d.thirdOfficer.email}, grad ${d.thirdOfficer.gradYear} (prefers ${d.thirdOfficer.preferredContact})` },
    { label: 'Instagram', value: d.club.instagramLink || '—' },
    { label: 'Discord', value: d.club.discordLink || '—' },
    { label: 'Faculty Advisor', value: `${d.club.advisorName} (${d.club.advisorEmail}) — ${d.club.advisorConfirmed}` },
    { label: 'Active Club Members', value: d.club.activeStudentsCount },
    { label: 'Interested Games', value: list(d.club.interestedGames) },
    { label: 'Biggest Barrier', value: d.club.clubBarrier },
    { label: 'Non-Roster Opportunities', value: list(d.club.nonRosterOpportunities) },
    { label: 'Inclusive Opportunities', value: list(d.club.inclusiveOpportunities) },
    { label: 'Separate Gaming Clubs/Groups', value: d.club.separateGamingClubs },
    { label: 'Contribute Beyond School', value: list(d.club.contributeBeyondSchool) },
    { label: 'Feedback', value: d.feedback || '—' },
    { label: 'Rules Agreement', value: d.agreedRules ? 'Agreed' : 'Disagreed' },
  ];
}

function formatSchoolApplicationDetailsV1(d: SchoolApplicationDetailsV1): { label: string; value: string }[] {
  return [
    { label: 'Preferred First Name', value: d.preferredFirstName || '—' },
    { label: 'Phone', value: d.phone || '—' },
    { label: 'Discord', value: d.discordTag || '—' },
    { label: 'School Code', value: d.schoolCode || '—' },
    { label: 'School Location', value: d.schoolLocation || '—' },
    { label: 'How They Heard About Us', value: d.howHeard || '—' },
    { label: 'LinkedIn', value: d.linkedin || '—' },
    { label: 'Captains / Coaches', value: d.captainsCoaches || '—' },
    { label: 'Team Notes', value: d.teamNotes || '—' },
    { label: 'Need Help Finding Players', value: d.needHelpFindingPlayers || '—' },
    { label: 'Preferred Communication Platform', value: d.preferredCommunicationPlatform || '—' },
    { label: 'Interested Divisions', value: d.interestedDivisions || '—' },
    { label: 'Rules Agreement', value: d.agreedRules ? 'Agreed' : 'Disagreed' },
    { label: 'Additional Notes', value: d.additionalNotes || '—' },
  ];
}
