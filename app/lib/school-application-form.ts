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
  agreedRules?: boolean;
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
  tetris: 'Tetris',
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

  if (!form.agreedRules) {
    errors.agreedRules = "You must agree to the EZ Esports league rules and terms.";
  }

  return errors;
}

// The application form has been fully restructured at least once already (the
// "v1" shape below predates the 4-layer club-officer form entirely — school
// code, a single captains/coaches blob, no VP/officer contacts). Rather than
// force every future redesign through a single fixed shape — coercing old
// rows into it (lossy) or leaving them permanently unparseable (what v1 rows
// were before this) — `details` is a discriminated union tagged by
// `version`. Each version keeps its own shape, its own formatter, and (for
// backfill) its own parser forever; a new form redesign is a new union
// member plus a version bump, never a migration of old rows.
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

export type SchoolApplicationDetails = SchoolApplicationDetailsV1 | SchoolApplicationDetailsV2;

function selectedLabels(selection: Record<string, boolean>, labels: Record<string, string>, otherText?: string): string[] {
  const result = Object.keys(labels)
    .filter((key) => selection[key])
    .map((key) => labels[key]);
  if (selection.other && otherText) {
    result.push(`Other: ${otherText.trim()}`);
  }
  return result;
}

export function compileApplicationPayload(form: SchoolApplicationFormData) {
  const selectedGames = selectedLabels(form.interestedGames, GAME_LABELS, form.interestedGamesOther);
  const barrierLabel =
    form.clubBarriers === 'other'
      ? `Other: ${form.clubBarriersOther?.trim() ?? ''}`
      : CLUB_BARRIER_LABELS[form.clubBarriers] ?? form.clubBarriers;
  const nonRosterOpportunities = selectedLabels(form.nonRosterOpportunities, NON_ROSTER_OPPORTUNITY_LABELS, form.nonRosterOpportunitiesOther);
  const inclusiveOpportunities = selectedLabels(form.inclusiveOpportunities, INCLUSIVE_OPPORTUNITY_LABELS, form.inclusiveOpportunitiesOther);
  const contributeBeyondSchool = selectedLabels(form.contributeBeyondSchool, CONTRIBUTE_BEYOND_SCHOOL_LABELS);

  const message = `
=== CLUB STATUS ===
${form.clubStatus}

=== 1. PRESIDENT INFO ===
President Name: ${form.presidentFirstName.trim()} ${form.presidentLastName.trim()}
School Name: ${form.schoolName.trim()}
Graduation Year: ${form.presidentGradYear}
Email: ${form.presidentEmail.trim()}
Discord Username: ${form.presidentDiscord.trim()}
Best Contact Platform: ${form.presidentPreferredContact.trim()}

=== 2. VICE PRESIDENT INFO ===
VP Name: ${form.vpFirstName.trim()} ${form.vpLastName.trim()}
Graduation Year: ${form.vpGradYear}
Discord Username: ${form.vpDiscord.trim()}
Email: ${form.vpEmail.trim()}
Best Contact Platform: ${form.vpPreferredContact.trim()}

=== 3. 3RD STUDENT CLUB OFFICER INFO ===
Officer Name: ${form.officerFirstName.trim()} ${form.officerLastName.trim()}
Graduation Year: ${form.officerGradYear}
Email: ${form.officerEmail.trim()}
Best Contact Platform: ${form.officerPreferredContact.trim()}

=== 4. CLUB INFO ===
Club's Instagram Link: ${form.instagramLink.trim()}
Club's Discord Link: ${form.discordLink.trim()}
Club Advisor Name: ${form.advisorName.trim()}
Club Advisor Email (@schools.nyc.gov): ${form.advisorEmail.trim()}
Faculty Advisor Confirmed: ${form.advisorConfirmed}
Estimated Active Club Members: ${form.activeStudentsCount.trim()}
Interested Games: ${selectedGames.join(", ")}
Biggest Barrier: ${barrierLabel}
Non-Roster Opportunities of Interest: ${nonRosterOpportunities.join(", ")}
Inclusive Participation Opportunities: ${inclusiveOpportunities.join(", ")}
Separate Gaming Clubs/Groups: ${form.separateGamingClubs.trim()}
Interested in Contributing Beyond School: ${contributeBeyondSchool.join(", ")}
Rules Agreement: ${form.agreedRules ? 'Agreed' : 'Disagreed'}

Feedback / Notes:
${form.feedback?.trim() || "N/A"}
`.trim();

  return {
    applicantName: `${form.presidentFirstName.trim()} ${form.presidentLastName.trim()}`,
    schoolName: form.schoolName.trim(),
    role: "Esports Club President",
    email: form.presidentEmail.trim(),
    message,
    details: buildSchoolApplicationDetails(form),
  };
}

export function buildSchoolApplicationDetails(form: SchoolApplicationFormData): SchoolApplicationDetailsV2 {
  const barrierLabel =
    form.clubBarriers === 'other'
      ? `Other: ${form.clubBarriersOther?.trim() ?? ''}`
      : CLUB_BARRIER_LABELS[form.clubBarriers] ?? form.clubBarriers;

  return {
    version: 2,
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
    agreedRules: !!form.agreedRules,
  };
}

const UNKNOWN_SHAPE_ROW = [{ label: 'Details', value: 'Could not display — unexpected data shape.' }];

/** `details` comes straight off a public, unauthenticated POST body — dispatching on `version` (rather than trusting the shape) means a row with an unrecognized or missing version, or one whose write-time guard only checked `object && !Array.isArray`, degrades to a message instead of throwing when a staff member expands it. */
export function formatSchoolApplicationDetails(d: SchoolApplicationDetails): { label: string; value: string }[] {
  switch (d?.version) {
    case 2: return formatSchoolApplicationDetailsV2(d);
    case 1: return formatSchoolApplicationDetailsV1(d);
    default: return UNKNOWN_SHAPE_ROW;
  }
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

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
}

function undoPlaceholder(value: string): string {
  return value.trim() === 'N/A' ? '' : value.trim();
}

/**
 * Reconstructs `SchoolApplicationDetails` from a legacy `message` blob for db/backfill-application-details.ts,
 * trying each known template newest-first. `null` if none match — an older form
 * version this repo doesn't have a parser for yet, or hand-edited data — so the row
 * fails closed and is left for a human to look at, rather than silently producing a
 * partially-wrong structured record.
 */
export function parseSchoolApplicationMessage(message: string): SchoolApplicationDetails | null {
  return parseSchoolApplicationMessageV2(message) ?? parseSchoolApplicationMessageV1(message);
}

// Matches the exact `=== SECTION ===` / `Label: value` shape compileApplicationPayload
// has always produced (the "v2" club-officer form, from the Google-Forms-parity redesign
// onward).
const SCHOOL_MESSAGE_PATTERN_V2 = new RegExp(
  '^=== CLUB STATUS ===\\n' +
  '(?<clubStatus>.*)\\n\\n' +
  '=== 1\\. PRESIDENT INFO ===\\n' +
  'President Name: (?<presName>.*)\\n' +
  'School Name: (?<schoolName>.*)\\n' +
  'Graduation Year: (?<presGradYear>.*)\\n' +
  'Email: (?<presEmail>.*)\\n' +
  'Discord Username: (?<presDiscord>.*)\\n' +
  'Best Contact Platform: (?<presContact>.*)\\n\\n' +
  '=== 2\\. VICE PRESIDENT INFO ===\\n' +
  'VP Name: (?<vpName>.*)\\n' +
  'Graduation Year: (?<vpGradYear>.*)\\n' +
  'Discord Username: (?<vpDiscord>.*)\\n' +
  'Email: (?<vpEmail>.*)\\n' +
  'Best Contact Platform: (?<vpContact>.*)\\n\\n' +
  '=== 3\\. 3RD STUDENT CLUB OFFICER INFO ===\\n' +
  'Officer Name: (?<offName>.*)\\n' +
  'Graduation Year: (?<offGradYear>.*)\\n' +
  'Email: (?<offEmail>.*)\\n' +
  'Best Contact Platform: (?<offContact>.*)\\n\\n' +
  '=== 4\\. CLUB INFO ===\\n' +
  "Club's Instagram Link: (?<instagram>.*)\\n" +
  "Club's Discord Link: (?<discordLink>.*)\\n" +
  'Club Advisor Name: (?<advisorName>.*)\\n' +
  'Club Advisor Email \\(@schools\\.nyc\\.gov\\): (?<advisorEmail>.*)\\n' +
  'Faculty Advisor Confirmed: (?<advisorConfirmed>.*)\\n' +
  'Estimated Active Club Members: (?<activeCount>.*)\\n' +
  'Interested Games: (?<games>.*)\\n' +
  'Biggest Barrier: (?<barrier>.*)\\n' +
  'Non-Roster Opportunities of Interest: (?<nonRoster>.*)\\n' +
  'Inclusive Participation Opportunities: (?<inclusive>.*)\\n' +
  'Separate Gaming Clubs/Groups: (?<separate>.*)\\n' +
  'Interested in Contributing Beyond School: (?<contribute>.*)\\n' +
  'Rules Agreement: (?<rulesAgreement>.*)\\n\\n' +
  'Feedback / Notes:\\n' +
  '(?<feedback>[\\s\\S]*)$'
);

function splitCsvLabels(value: string): string[] {
  return value === '' ? [] : value.split(', ');
}

function parseSchoolApplicationMessageV2(message: string): SchoolApplicationDetailsV2 | null {
  const match = SCHOOL_MESSAGE_PATTERN_V2.exec(message.trim());
  if (!match?.groups) return null;
  const g = match.groups;

  const president = splitName(g.presName);
  const vp = splitName(g.vpName);
  const officer = splitName(g.offName);

  return {
    version: 2,
    clubStatus: g.clubStatus,
    president: {
      firstName: president.firstName,
      lastName: president.lastName,
      gradYear: g.presGradYear,
      email: g.presEmail,
      discord: g.presDiscord,
      preferredContact: g.presContact,
    },
    vicePresident: {
      firstName: vp.firstName,
      lastName: vp.lastName,
      gradYear: g.vpGradYear,
      discord: g.vpDiscord,
      email: g.vpEmail,
      preferredContact: g.vpContact,
    },
    thirdOfficer: {
      firstName: officer.firstName,
      lastName: officer.lastName,
      gradYear: g.offGradYear,
      email: g.offEmail,
      preferredContact: g.offContact,
    },
    club: {
      instagramLink: g.instagram,
      discordLink: g.discordLink,
      advisorName: g.advisorName,
      advisorEmail: g.advisorEmail,
      advisorConfirmed: g.advisorConfirmed,
      activeStudentsCount: g.activeCount,
      interestedGames: splitCsvLabels(g.games),
      clubBarrier: g.barrier,
      nonRosterOpportunities: splitCsvLabels(g.nonRoster),
      inclusiveOpportunities: splitCsvLabels(g.inclusive),
      separateGamingClubs: g.separate,
      contributeBeyondSchool: splitCsvLabels(g.contribute),
    },
    feedback: g.feedback.trim(),
    agreedRules: g.rulesAgreement.trim() === 'Agreed',
  };
}

// Matches the team-registration-style template that predates the club-officer
// redesign — no VP/officer contacts, a single free-text captains/coaches blob.
const SCHOOL_MESSAGE_PATTERN_V1 = new RegExp(
  '^Preferred first name: (?<preferredFirstName>.*)\\n' +
  'Phone number: (?<phone>.*)\\n' +
  'Discord tag: (?<discordTag>.*)\\n' +
  'School code: (?<schoolCode>.*)\\n' +
  'School location: (?<schoolLocation>.*)\\n' +
  'How did you learn about us: (?<howHeard>.*)\\n' +
  'LinkedIn profile: (?<linkedin>.*)\\n\\n' +
  'Captains / Coaches:\\n' +
  '(?<captainsCoaches>[\\s\\S]*?)\\n\\n' +
  'Anything to know about team:\\n' +
  '(?<teamNotes>[\\s\\S]*?)\\n\\n' +
  'Need help finding players: (?<needHelpFindingPlayers>.*)\\n' +
  'Preferred communication platform: (?<preferredCommunicationPlatform>.*)\\n' +
  'Interested Divisions: (?<interestedDivisions>.*)\\n' +
  'Rules Agreement: (?<rulesAgreement>.*)\\n\\n' +
  'Additional Notes:\\n' +
  '(?<additionalNotes>[\\s\\S]*)$'
);

function parseSchoolApplicationMessageV1(message: string): SchoolApplicationDetailsV1 | null {
  const match = SCHOOL_MESSAGE_PATTERN_V1.exec(message.trim());
  if (!match?.groups) return null;
  const g = match.groups;

  return {
    version: 1,
    preferredFirstName: undoPlaceholder(g.preferredFirstName),
    phone: g.phone.trim(),
    discordTag: undoPlaceholder(g.discordTag),
    schoolCode: g.schoolCode.trim(),
    schoolLocation: g.schoolLocation.trim(),
    howHeard: g.howHeard.trim(),
    linkedin: undoPlaceholder(g.linkedin),
    captainsCoaches: g.captainsCoaches.trim(),
    teamNotes: g.teamNotes.trim(),
    needHelpFindingPlayers: g.needHelpFindingPlayers.trim(),
    preferredCommunicationPlatform: g.preferredCommunicationPlatform.trim(),
    interestedDivisions: g.interestedDivisions.trim(),
    agreedRules: g.rulesAgreement.trim() === 'Agreed',
    additionalNotes: g.additionalNotes.trim(),
  };
}
