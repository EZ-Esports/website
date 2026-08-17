export interface SchoolApplicationFormData {
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

  clubSocials?: string;
  advisorName: string;
  advisorEmail: string;
  activeStudentsCount: string;
  interestedGames: Record<string, boolean>;
  interestedGamesOther?: string;
  feedback?: string;
  agreedRules?: boolean;
}

export function validateSchoolApplicationForm(form: SchoolApplicationFormData) {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const errors: Record<string, string> = {};

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
  if (!form.advisorName.trim()) errors.advisorName = "Club advisor name is required.";
  if (!form.advisorEmail.trim()) errors.advisorEmail = "Club advisor email is required.";
  else if (!EMAIL_RE.test(form.advisorEmail)) errors.advisorEmail = "Enter a valid email address.";
  if (!form.activeStudentsCount.trim()) errors.activeStudentsCount = "Estimated student count is required.";

  const hasGame = Object.values(form.interestedGames).some(Boolean);
  if (!hasGame) {
    errors.interestedGames = "Select at least one game your club is interested in.";
  } else if (form.interestedGames.other && !form.interestedGamesOther?.trim()) {
    errors.interestedGamesOther = "Please specify the other game.";
  }

  if (form.agreedRules === false) {
    errors.agreedRules = "You must agree to the EZ Esports league rules and terms.";
  }

  return errors;
}

export function compileApplicationPayload(form: SchoolApplicationFormData) {
  const selectedGames: string[] = [];
  if (form.interestedGames.valorant) selectedGames.push("Valorant");
  if (form.interestedGames.lol) selectedGames.push("League of Legends (LoL)");
  if (form.interestedGames.tft) selectedGames.push("Teamfight Tactics (TFT)");
  if (form.interestedGames.tetris) selectedGames.push("Tetris");
  if (form.interestedGames.clashRoyale) selectedGames.push("Clash Royale");
  if (form.interestedGames.other && form.interestedGamesOther) {
    selectedGames.push(`Other: ${form.interestedGamesOther.trim()}`);
  }

  const message = `
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
Club Socials:
${form.clubSocials?.trim() || "N/A"}

Club Advisor Name: ${form.advisorName.trim()}
Club Advisor Email (@schools.nyc.gov): ${form.advisorEmail.trim()}
Estimated Active Club Members: ${form.activeStudentsCount.trim()}
Interested Games: ${selectedGames.join(", ")}

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
