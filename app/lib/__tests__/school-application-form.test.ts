import { describe, expect, it } from "vitest";
import {
  compileApplicationPayload,
  validateSchoolApplicationForm,
  buildSchoolApplicationDetails,
  parseSchoolApplicationMessage,
} from "@/app/lib/school-application-form";

describe("School Application Form Validation & Consolidation", () => {
  const validForm = {
    clubStatus: "Active and returning",

    presidentFirstName: "Jane",
    presidentLastName: "Doe",
    schoolName: "Brooklyn Tech",
    presidentGradYear: "'27",
    presidentEmail: "jane@example.com",
    presidentDiscord: "janedoe",
    presidentPreferredContact: "Discord",

    vpFirstName: "Alex",
    vpLastName: "Smith",
    vpGradYear: "'28",
    vpDiscord: "alexsmith",
    vpEmail: "alex@example.com",
    vpPreferredContact: "Email",

    officerFirstName: "Jordan",
    officerLastName: "Lee",
    officerGradYear: "'29",
    officerEmail: "jordan@example.com",
    officerPreferredContact: "SMS",

    instagramLink: "https://instagram.com/bkltechnesports",
    discordLink: "https://discord.gg/bkltech",
    advisorName: "Mr. Davis",
    advisorEmail: "davis@schools.nyc.gov",
    advisorConfirmed: "Yes",
    activeStudentsCount: "30",
    interestedGames: { valorant: true, clashRoyale: true },
    clubBarriers: "recruitingPlayers",
    nonRosterOpportunities: { oneDayTournaments: true },
    inclusiveOpportunities: { friendlyScrimmages: true },
    separateGamingClubs: "N/A",
    contributeBeyondSchool: { notAtThisTime: true },
    feedback: "Excited for the upcoming season!",
    agreedRules: true,
  };

  it("validates a complete 4-layer form with no errors", () => {
    const errors = validateSchoolApplicationForm(validForm);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it("requires all 3 points of contact (President, VP, 3rd Officer)", () => {
    const missingVp = { ...validForm, vpFirstName: "", vpEmail: "" };
    const errors = validateSchoolApplicationForm(missingVp);
    expect(errors.vpFirstName).toBeDefined();
    expect(errors.vpEmail).toBeDefined();
  });

  it("requires advisor details and interested games", () => {
    const missingAdvisor = { ...validForm, advisorName: "", interestedGames: { valorant: false } };
    const errors = validateSchoolApplicationForm(missingAdvisor);
    expect(errors.advisorName).toBeDefined();
    expect(errors.interestedGames).toBeDefined();
  });

  it("requires custom game text when other is selected", () => {
    const withOtherNoText = {
      ...validForm,
      interestedGames: { other: true },
      interestedGamesOther: "",
    };
    const errors = validateSchoolApplicationForm(withOtherNoText);
    expect(errors.interestedGamesOther).toBeDefined();
  });

  it("requires club status, socials, advisor confirmation, and barrier selection", () => {
    const missingFields = {
      ...validForm,
      clubStatus: "",
      instagramLink: "",
      discordLink: "",
      advisorConfirmed: "",
      clubBarriers: "",
      separateGamingClubs: "",
    };
    const errors = validateSchoolApplicationForm(missingFields);
    expect(errors.clubStatus).toBeDefined();
    expect(errors.instagramLink).toBeDefined();
    expect(errors.discordLink).toBeDefined();
    expect(errors.advisorConfirmed).toBeDefined();
    expect(errors.clubBarriers).toBeDefined();
    expect(errors.separateGamingClubs).toBeDefined();
  });

  it("requires custom barrier text when the barrier is 'other'", () => {
    const withOtherNoText = { ...validForm, clubBarriers: "other", clubBarriersOther: "" };
    const errors = validateSchoolApplicationForm(withOtherNoText);
    expect(errors.clubBarriersOther).toBeDefined();
  });

  it("requires at least one selection for opportunity and contribution checkbox groups", () => {
    const emptyGroups = {
      ...validForm,
      nonRosterOpportunities: {},
      inclusiveOpportunities: {},
      contributeBeyondSchool: {},
    };
    const errors = validateSchoolApplicationForm(emptyGroups);
    expect(errors.nonRosterOpportunities).toBeDefined();
    expect(errors.inclusiveOpportunities).toBeDefined();
    expect(errors.contributeBeyondSchool).toBeDefined();
  });

  it("requires rules agreement when set to false", () => {
    const withoutRules = { ...validForm, agreedRules: false };
    const errors = validateSchoolApplicationForm(withoutRules);
    expect(errors.agreedRules).toBeDefined();
  });

  it("records Disagreed in compiled message payload when agreedRules is false", () => {
    const payload = compileApplicationPayload({ ...validForm, agreedRules: false });
    expect(payload.message).toContain("Rules Agreement: Disagreed");
  });

  it("compiles message payload correctly with all 4 layers", () => {
    const payload = compileApplicationPayload(validForm);
    expect(payload.applicantName).toBe("Jane Doe");
    expect(payload.schoolName).toBe("Brooklyn Tech");
    expect(payload.role).toBe("Esports Club President");
    expect(payload.email).toBe("jane@example.com");
    expect(payload.message).toContain("=== 1. PRESIDENT INFO ===");
    expect(payload.message).toContain("=== 2. VICE PRESIDENT INFO ===");
    expect(payload.message).toContain("=== 3. 3RD STUDENT CLUB OFFICER INFO ===");
    expect(payload.message).toContain("=== 4. CLUB INFO ===");
    expect(payload.message).toContain("Valorant, Clash Royale");
    expect(payload.message).toContain("Rules Agreement: Agreed");
  });

  it("builds structured details alongside the compiled message", () => {
    const payload = compileApplicationPayload(validForm);
    expect(payload.details).toEqual(buildSchoolApplicationDetails(validForm));
    expect(payload.details.president).toEqual({
      firstName: "Jane",
      lastName: "Doe",
      gradYear: "'27",
      email: "jane@example.com",
      discord: "janedoe",
      preferredContact: "Discord",
    });
    expect(payload.details.club.interestedGames).toEqual(["Valorant", "Clash Royale"]);
    expect(payload.details.agreedRules).toBe(true);
  });

  it("parses a compiled message back into the same structured details", () => {
    const payload = compileApplicationPayload(validForm);
    expect(parseSchoolApplicationMessage(payload.message)).toEqual(payload.details);
  });

  it("returns null when a message doesn't match the known template", () => {
    expect(parseSchoolApplicationMessage("some unrelated legacy free text")).toBeNull();
    expect(parseSchoolApplicationMessage("")).toBeNull();
  });
});
