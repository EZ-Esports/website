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
  };
}
