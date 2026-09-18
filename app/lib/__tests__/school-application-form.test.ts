import { describe, expect, it } from "vitest";
import {
  compileApplicationPayload,
  validateSchoolApplicationForm,
  buildSchoolApplicationDetails,
  formatSchoolApplicationDetails,
  type SchoolApplicationDetails,
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
    interestedGames: { valorant: true, osu: true },
    clubBarriers: "recruitingPlayers",
    nonRosterOpportunities: { oneDayTournaments: true },
    inclusiveOpportunities: { friendlyScrimmages: true },
    separateGamingClubs: "N/A",
    contributeBeyondSchool: { notAtThisTime: true },
    feedback: "Excited for the upcoming season!",
    agreedToRules: true,
    agreedToTerms: true,
    agreedToPrivacy: true,
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

  it("requires each of the three consents independently", () => {
    const noRules = { ...validForm, agreedToRules: false };
    expect(validateSchoolApplicationForm(noRules).agreedToRules).toBeDefined();

    const noTerms = { ...validForm, agreedToTerms: false };
    expect(validateSchoolApplicationForm(noTerms).agreedToTerms).toBeDefined();

    const noPrivacy = { ...validForm, agreedToPrivacy: false };
    expect(validateSchoolApplicationForm(noPrivacy).agreedToPrivacy).toBeDefined();

    // Agreeing to one or two doesn't satisfy the others — each is independent.
    const onlyRules = { ...validForm, agreedToRules: true, agreedToTerms: false, agreedToPrivacy: false };
    const errors = validateSchoolApplicationForm(onlyRules);
    expect(errors.agreedToRules).toBeUndefined();
    expect(errors.agreedToTerms).toBeDefined();
    expect(errors.agreedToPrivacy).toBeDefined();
  });

  it("compiles a payload with no message field — details is the sole source of truth for new submissions", () => {
    const payload = compileApplicationPayload(validForm);
    expect(payload).toEqual({
      applicantName: "Jane Doe",
      schoolName: "Brooklyn Tech",
      role: "Esports Club President",
      email: "jane@example.com",
      details: expect.any(Object),
    });
  });

  it("builds structured details alongside the compiled payload", () => {
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
    expect(payload.details.club.interestedGames).toEqual(["Valorant", "osu!"]);
    expect(payload.details.consent).toEqual({
      agreedToRules: true,
      agreedToTerms: true,
      agreedToPrivacy: true,
    });
  });

  it("degrades to a message instead of throwing when details is a malformed shape", () => {
    // API-route input validation only checks `typeof === 'object' && !Array.isArray` —
    // an empty object or one missing nested fields passes that check but isn't a real
    // SchoolApplicationDetails, so the formatter must not assume the shape is intact.
    const malformed = {} as SchoolApplicationDetails;
    expect(() => formatSchoolApplicationDetails(malformed)).not.toThrow();
    expect(formatSchoolApplicationDetails(malformed)).toEqual([
      { label: "Details", value: "Could not display — unexpected data shape." },
    ]);
  });

  it("formats each of the three consents as its own labeled row (v3)", () => {
    const details = buildSchoolApplicationDetails({ ...validForm, agreedToRules: true, agreedToTerms: false, agreedToPrivacy: true });
    const rows = formatSchoolApplicationDetails(details);
    expect(rows.find((r) => r.label === "League Rules & Code of Conduct")?.value).toBe("Agreed");
    expect(rows.find((r) => r.label === "Terms of Service")?.value).toBe("Disagreed");
    expect(rows.find((r) => r.label === "Privacy & Data Handling")?.value).toBe("Agreed");
  });

  it("falls back to '—' for club fields that aren't arrays", () => {
    const details = buildSchoolApplicationDetails(validForm);
    const corrupted = { ...details, club: { ...details.club, interestedGames: "Valorant" as unknown as string[] } };
    const rows = formatSchoolApplicationDetails(corrupted);
    expect(rows.find((r) => r.label === "Interested Games")?.value).toBe("Valorant");
  });

  describe("v1 (legacy team-registration) shape — format-only, no live parser", () => {
    // Old rows can still carry this shape in `details` even though the parser that
    // used to backfill it from a `message` blob is gone (issue #166) — the format
    // function must keep rendering it forever since those rows are immutable.
    it("formats a v1 details object without throwing", () => {
      const v1Details: SchoolApplicationDetails = {
        version: 1,
        preferredFirstName: "Kyle",
        phone: "9295597584",
        discordTag: "keeyul_",
        schoolCode: "22K535",
        schoolLocation: "Brooklyn",
        howHeard: "Friend/teacher/parent",
        linkedin: "",
        captainsCoaches: "[Valorant] Ethan Chu, ethanc306@nycstudents.net, 917-740-7047",
        teamNotes: "no",
        needHelpFindingPlayers: "No",
        preferredCommunicationPlatform: "discord",
        interestedDivisions: "valorant",
        agreedRules: true,
        additionalNotes: "no",
      };
      const rows = formatSchoolApplicationDetails(v1Details);
      expect(rows.find((r) => r.label === "School Code")?.value).toBe("22K535");
      expect(rows.find((r) => r.label === "Rules Agreement")?.value).toBe("Agreed");
    });
  });
});
