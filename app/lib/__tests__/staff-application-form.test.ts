import { describe, expect, it } from "vitest";
import {
  buildStaffApplicationDetails,
  formatStaffApplicationDetails,
  isStaffRole,
  normalizeOptionalUrl,
  parseStaffApplicationDetails,
  STAFF_ROLES,
  type StaffRole,
  type StaffApplicationDetailsV1,
  type StaffApplicationDetailsV2,
  type StaffApplicationFormData,
} from "@/app/lib/staff-application-form";

const validForm: StaffApplicationFormData = {
  name: "Jane Smith",
  preferredFirstName: "Janie",
  email: "jane@example.com",
  phone: "(555) 555-5555",
  discordTag: "janesmith",
  role: "Marketing Division",
  message: "I have run a Discord community of 500 members for two years.",
  linkedin: "https://linkedin.com/in/janesmith",
  workSamples: "https://github.com/janesmith",
  availability: "10hrs",
  agreedToTerms: true,
  agreedToPrivacy: true,
  acknowledgedUnpaidVolunteer: true,
};

describe("Staff Application Details", () => {
  it("builds structured details from the form", () => {
    const details = buildStaffApplicationDetails(validForm);
    expect(details).toEqual({
      version: 3,
      preferredFirstName: "Janie",
      discordTag: "janesmith",
      linkedin: "https://linkedin.com/in/janesmith",
      workSamples: "https://github.com/janesmith",
      availability: "10hrs",
      consent: { agreedToTerms: true, agreedToPrivacy: true, acknowledgedUnpaidVolunteer: true },
      backgroundMotivation: "I have run a Discord community of 500 members for two years.",
    });
  });

  it("captures the background & motivation textarea into details", () => {
    const details = buildStaffApplicationDetails({ ...validForm, message: "  Some padded answer.  " });
    expect(details.backgroundMotivation).toBe("Some padded answer.");
  });

  it("formats v3 details into labeled rows, with a LinkedIn-only label", () => {
    expect(formatStaffApplicationDetails(buildStaffApplicationDetails(validForm))).toEqual([
      { label: "LinkedIn", value: "https://linkedin.com/in/janesmith" },
      { label: "Other Links", value: "https://github.com/janesmith" },
      { label: "Weekly Availability", value: "10hrs" },
      { label: "Terms of Service", value: "Agreed" },
      { label: "Privacy Policy", value: "Agreed" },
      { label: "Unpaid Volunteer Role", value: "Acknowledged" },
      { label: "Why EZ Esports", value: "I have run a Discord community of 500 members for two years." },
    ]);
  });

  it("falls back to an em dash when the free-text answer or LinkedIn is blank", () => {
    const rows = formatStaffApplicationDetails(
      buildStaffApplicationDetails({ ...validForm, message: "", linkedin: "", workSamples: "" }),
    );
    expect(rows).toContainEqual({ label: "Why EZ Esports", value: "—" });
    expect(rows).toContainEqual({ label: "LinkedIn", value: "—" });
    expect(rows).toContainEqual({ label: "Other Links", value: "—" });
  });

  it("still formats v2 rows with their original LinkedIn / Portfolio label", () => {
    const v2: StaffApplicationDetailsV2 = {
      version: 2,
      preferredFirstName: "Janie",
      discordTag: "janesmith",
      linkedin: "https://janesmith.dev/resume.pdf",
      availability: "10hrs",
      consent: { agreedToTerms: true, agreedToPrivacy: true },
      backgroundMotivation: "Motivated.",
    };
    const rows = formatStaffApplicationDetails(v2);
    expect(rows).toContainEqual({ label: "LinkedIn / Portfolio", value: "https://janesmith.dev/resume.pdf" });
    expect(rows).toContainEqual({ label: "Background & Motivation", value: "Motivated." });
    expect(rows.map((r) => r.label)).not.toContain("Unpaid Volunteer Role");
  });

  it("still formats legacy v1 rows (pre-#107 single agreedRules checkbox)", () => {
    const legacy: StaffApplicationDetailsV1 = {
      version: 1,
      preferredFirstName: "Janie",
      discordTag: "janesmith",
      linkedin: "https://linkedin.com/in/janesmith",
      availability: "10hrs",
      agreedRules: true,
      backgroundMotivation: "I have run a Discord community of 500 members for two years.",
    };
    expect(formatStaffApplicationDetails(legacy)).toEqual([
      { label: "LinkedIn / Portfolio", value: "https://linkedin.com/in/janesmith" },
      { label: "Weekly Availability", value: "10hrs" },
      { label: "Rules Agreement", value: "Agreed" },
      {
        label: "Background & Motivation",
        value: "I have run a Discord community of 500 members for two years.",
      },
    ]);
  });

  it("degrades to a message instead of rendering garbage for an unrecognized version", () => {
    const unknown = { version: 99 } as unknown as ReturnType<typeof buildStaffApplicationDetails>;
    expect(formatStaffApplicationDetails(unknown)).toEqual([
      { label: "Details", value: "Could not display — unexpected data shape." },
    ]);
  });

  it("offers exactly the nine divisions, in order", () => {
    expect([...STAFF_ROLES]).toEqual([
      "Software Engineering Division",
      "Marketing Division",
      "Operations Division",
      "Development Division",
      "Productions Crew",
      "Legal Division",
      "VALORANT Division",
      "League of Legends Division",
      "Teamfight Tactics Division",
    ]);
  });

  it("rejects retired role values and the old Other option", () => {
    const validRole: StaffRole = "VALORANT Division";
    expect(isStaffRole(validRole)).toBe(true);
    expect(isStaffRole("Games Division")).toBe(false);
    expect(isStaffRole("Community Moderator")).toBe(false);
    expect(isStaffRole("Other: Something")).toBe(false);
    expect(isStaffRole(undefined)).toBe(false);
  });
});

describe("normalizeOptionalUrl", () => {
  it("keeps blank as blank", () => {
    expect(normalizeOptionalUrl("")).toBe("");
    expect(normalizeOptionalUrl("   ")).toBe("");
  });

  it("accepts http(s) URLs and adds https:// to a bare host", () => {
    expect(normalizeOptionalUrl("https://www.linkedin.com/in/jane")).toBe("https://www.linkedin.com/in/jane");
    expect(normalizeOptionalUrl("  linkedin.com/in/jane ")).toBe("https://linkedin.com/in/jane");
    expect(normalizeOptionalUrl("http://linkedin.com/in/jane")).toBe("http://linkedin.com/in/jane");
  });

  it("rejects things that are not web links", () => {
    expect(normalizeOptionalUrl("jane smith")).toBeNull();
    expect(normalizeOptionalUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeOptionalUrl("mailto:jane@example.com")).toBeNull();
    expect(normalizeOptionalUrl("localhost")).toBeNull();
    expect(normalizeOptionalUrl("https://")).toBeNull();
  });
});

describe("parseStaffApplicationDetails (server-side gate)", () => {
  const valid = () => JSON.parse(JSON.stringify(buildStaffApplicationDetails(validForm)));

  it("accepts a well-formed v3 submission", () => {
    const result = parseStaffApplicationDetails(valid());
    expect(result).toEqual({ ok: true, details: buildStaffApplicationDetails(validForm) });
  });

  it("rebuilds the object so unknown client keys are not persisted", () => {
    const result = parseStaffApplicationDetails({ ...valid(), injected: "x", version: 99 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.details).not.toHaveProperty("injected");
      expect(result.details.version).toBe(3);
    }
  });

  it("rejects missing, null and array details", () => {
    expect(parseStaffApplicationDetails(null).ok).toBe(false);
    expect(parseStaffApplicationDetails(undefined).ok).toBe(false);
    expect(parseStaffApplicationDetails([]).ok).toBe(false);
  });

  it("requires the Terms and Privacy consents to be strictly true", () => {
    for (const key of ["agreedToTerms", "agreedToPrivacy"]) {
      for (const bad of [false, "true", 1, undefined]) {
        const d = valid();
        d.consent[key] = bad;
        expect(parseStaffApplicationDetails(d)).toEqual({
          ok: false,
          error: "You must agree to the Terms of Service and Privacy Policy to submit an application.",
        });
      }
    }
  });

  it("requires the unpaid volunteer acknowledgement to be strictly true", () => {
    for (const bad of [false, "true", 1, undefined, null]) {
      const d = valid();
      d.consent.acknowledgedUnpaidVolunteer = bad;
      expect(parseStaffApplicationDetails(d)).toEqual({
        ok: false,
        error: "You must acknowledge that this is a part-time, unpaid volunteer position.",
      });
    }
  });

  it("rejects a pre-v3 payload that has no acknowledgement at all", () => {
    const d = valid();
    delete d.consent.acknowledgedUnpaidVolunteer;
    expect(parseStaffApplicationDetails(d).ok).toBe(false);
  });

  it("treats LinkedIn as optional but validates it when given", () => {
    const blank = parseStaffApplicationDetails({ ...valid(), linkedin: "" });
    expect(blank.ok && blank.details.linkedin).toBe("");

    const bare = parseStaffApplicationDetails({ ...valid(), linkedin: "linkedin.com/in/jane" });
    expect(bare.ok && bare.details.linkedin).toBe("https://linkedin.com/in/jane");

    expect(parseStaffApplicationDetails({ ...valid(), linkedin: "not a url" })).toEqual({
      ok: false,
      error: "Enter a valid LinkedIn profile URL, or leave it blank.",
    });
  });

  it("keeps optional other links as trimmed free text, with a length cap", () => {
    const ok = parseStaffApplicationDetails({ ...valid(), workSamples: "  github.com/jane, jane.design  " });
    expect(ok.ok && ok.details.workSamples).toBe("github.com/jane, jane.design");

    const none = parseStaffApplicationDetails({ ...valid(), workSamples: undefined });
    expect(none.ok && none.details.workSamples).toBe("");

    expect(parseStaffApplicationDetails({ ...valid(), workSamples: "x".repeat(1001) }).ok).toBe(false);
  });

  it("requires the why-join answer", () => {
    expect(parseStaffApplicationDetails({ ...valid(), backgroundMotivation: "   " })).toEqual({
      ok: false,
      error: "Please tell us why you want to join EZ Esports.",
    });
  });
});
