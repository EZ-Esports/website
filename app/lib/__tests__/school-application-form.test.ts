import { describe, expect, it } from "vitest";
import { compileApplicationPayload, validateSchoolApplicationForm } from "@/app/lib/school-application-form";

describe("School Application Form Validation & Consolidation", () => {
  const validForm = {
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

    advisorName: "Mr. Davis",
    advisorEmail: "davis@schools.nyc.gov",
    activeStudentsCount: "30",
    interestedGames: { valorant: true, clashRoyale: true },
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

  it("requires rules agreement when set to false", () => {
    const withoutRules = { ...validForm, agreedRules: false };
    const errors = validateSchoolApplicationForm(withoutRules);
    expect(errors.agreedRules).toBeDefined();
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
  });
});
