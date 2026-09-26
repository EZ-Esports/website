import { describe, expect, it } from "vitest";
import {
  buildStaffApplicationDetails,
  formatStaffApplicationDetails,
  characterLimitNotice,
  checkGameDirectorAnswer,
  checkWhyJoinAnswer,
  WHY_JOIN_MAX_LENGTH,
  GAME_DIRECTOR_MAX_LENGTH,
  GAME_REGULATIONS_ROLE,
  isStaffRole,
  normalizeLinkedInUrl,
  normalizeOptionalUrl,
  parseStaffApplicationDetails,
  STAFF_ROLES,
  type StaffRole,
  type StaffApplicationDetailsV1,
  type StaffApplicationDetailsV2,
  type StaffApplicationDetailsV3,
  type StaffApplicationFormData,
} from "@/app/lib/staff-application-form";

const validForm: StaffApplicationFormData = {
  name: "Jane Smith",
  preferredFirstName: "Janie",
  email: "jane@example.com",
  phone: "(555) 555-5555",
  discordTag: "janesmith",
  role: "Marketing Division",
  gameDirector: "",
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
      version: 4,
      gameDirector: "",
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

  it("formats v4 details into labeled rows, with a LinkedIn-only label", () => {
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

  it("offers exactly the seven divisions, in order", () => {
    expect([...STAFF_ROLES]).toEqual([
      "Software Engineering Division",
      "Marketing Division",
      "Operations Division",
      "Development Division",
      "Productions Crew",
      "Legal Division",
      "Game Regulations Division",
    ]);
  });

  it("checks the Game Regulations open answer: trimmed, non-empty, at most 500 characters", () => {
    expect(GAME_DIRECTOR_MAX_LENGTH).toBe(500);
    expect(checkGameDirectorAnswer("VALORANT, two seasons as a team captain")).toBeNull();
    expect(checkGameDirectorAnswer("")).toBe("Please tell us which game director position you are interested in.");
    expect(checkGameDirectorAnswer("   \n  ")).toBe("Please tell us which game director position you are interested in.");
    expect(checkGameDirectorAnswer("x".repeat(500))).toBeNull();
    expect(checkGameDirectorAnswer(`  ${"x".repeat(500)}  `)).toBeNull();
    expect(checkGameDirectorAnswer("x".repeat(501))).toBe("Your game director answer must be 500 characters or fewer.");
  });

  it("rejects retired role values and the old Other option", () => {
    const validRole: StaffRole = GAME_REGULATIONS_ROLE;
    expect(isStaffRole(validRole)).toBe(true);
    expect(isStaffRole("VALORANT Division")).toBe(false);
    expect(isStaffRole("League of Legends Division")).toBe(false);
    expect(isStaffRole("Teamfight Tactics Division")).toBe(false);
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
  const parse = (raw: unknown, role: string = validForm.role) => parseStaffApplicationDetails(raw, role);

  it("accepts a well-formed v4 submission", () => {
    const result = parse(valid());
    expect(result).toEqual({ ok: true, details: buildStaffApplicationDetails(validForm) });
  });

  it("rebuilds the object so unknown client keys are not persisted", () => {
    const result = parse({ ...valid(), injected: "x", version: 99 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.details).not.toHaveProperty("injected");
      expect(result.details.version).toBe(4);
    }
  });

  it("rejects missing, null and array details", () => {
    expect(parse(null).ok).toBe(false);
    expect(parse(undefined).ok).toBe(false);
    expect(parse([]).ok).toBe(false);
  });

  it("requires the Terms and Privacy consents to be strictly true", () => {
    for (const key of ["agreedToTerms", "agreedToPrivacy"]) {
      for (const bad of [false, "true", 1, undefined]) {
        const d = valid();
        d.consent[key] = bad;
        expect(parse(d)).toEqual({
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
      expect(parse(d)).toEqual({
        ok: false,
        error: "You must acknowledge that this is a part-time, unpaid volunteer position.",
      });
    }
  });

  it("rejects a pre-v3 payload that has no acknowledgement at all", () => {
    const d = valid();
    delete d.consent.acknowledgedUnpaidVolunteer;
    expect(parse(d).ok).toBe(false);
  });

  it("treats LinkedIn as optional but validates it when given", () => {
    const blank = parse({ ...valid(), linkedin: "" });
    expect(blank.ok && blank.details.linkedin).toBe("");

    const bare = parse({ ...valid(), linkedin: "linkedin.com/in/jane" });
    expect(bare.ok && bare.details.linkedin).toBe("https://linkedin.com/in/jane");

    expect(parse({ ...valid(), linkedin: "not a url" })).toEqual({
      ok: false,
      error: "Enter a LinkedIn profile link (linkedin.com/in/…), or leave it blank.",
    });
  });

  it("accepts only linkedin.com hosts for LinkedIn", () => {
    expect(parse({ ...valid(), linkedin: "https://github.com/jane" }).ok).toBe(false);
    expect(parse({ ...valid(), linkedin: "linkedin.com.evil.example/in/jane" }).ok).toBe(false);
    const regional = parse({ ...valid(), linkedin: "uk.linkedin.com/in/jane" });
    expect(regional.ok && regional.details.linkedin).toBe("https://uk.linkedin.com/in/jane");
  });

  it("requires the game director answer only for the Game Regulations Division", () => {
    const required = { ok: false, error: "Please tell us which game director position you are interested in." };
    expect(parse(valid(), GAME_REGULATIONS_ROLE)).toEqual(required);
    expect(parse({ ...valid(), gameDirector: "   " }, GAME_REGULATIONS_ROLE)).toEqual(required);
    expect(parse({ ...valid(), gameDirector: ["VALORANT"] }, GAME_REGULATIONS_ROLE)).toEqual(required);
    expect(parse({ ...valid(), gameDirector: 42 }, GAME_REGULATIONS_ROLE)).toEqual(required);

    const ok = parse({ ...valid(), gameDirector: "  League of Legends; I ran my school's LoL club.  " }, GAME_REGULATIONS_ROLE);
    expect(ok.ok && ok.details.gameDirector).toBe("League of Legends; I ran my school's LoL club.");
  });

  it("caps the game director answer at 500 characters after trimming", () => {
    expect(parse({ ...valid(), gameDirector: "x".repeat(500) }, GAME_REGULATIONS_ROLE).ok).toBe(true);
    expect(parse({ ...valid(), gameDirector: "x".repeat(501) }, GAME_REGULATIONS_ROLE)).toEqual({
      ok: false,
      error: "Your game director answer must be 500 characters or fewer.",
    });
  });

  it("ignores and clears a stray game director answer for any other division", () => {
    const result = parse({ ...valid(), gameDirector: "VALORANT" }, "Marketing Division");
    expect(result.ok && result.details.gameDirector).toBe("");
    const tooLong = parse({ ...valid(), gameDirector: "x".repeat(900) }, "Legal Division");
    expect(tooLong.ok && tooLong.details.gameDirector).toBe("");
  });

  it("keeps optional other links as trimmed free text, with a length cap", () => {
    const ok = parse({ ...valid(), workSamples: "  github.com/jane, jane.design  " });
    expect(ok.ok && ok.details.workSamples).toBe("github.com/jane, jane.design");

    const none = parse({ ...valid(), workSamples: undefined });
    expect(none.ok && none.details.workSamples).toBe("");

    expect(parse({ ...valid(), workSamples: "x".repeat(1001) }).ok).toBe(false);
  });

  it("caps the why-join answer at 1,500 characters after trimming", () => {
    expect(parse({ ...valid(), backgroundMotivation: "x".repeat(1500) }).ok).toBe(true);
    expect(parse({ ...valid(), backgroundMotivation: `  ${"x".repeat(1500)}  ` }).ok).toBe(true);
    expect(parse({ ...valid(), backgroundMotivation: "x".repeat(1501) })).toEqual({
      ok: false,
      error: "Your answer must be 1,500 characters or fewer.",
    });
  });

  it("requires the why-join answer", () => {
    expect(parse({ ...valid(), backgroundMotivation: "   " })).toEqual({
      ok: false,
      error: "Please tell us why you want to join EZ Esports.",
    });
  });
});

describe("normalizeLinkedInUrl", () => {
  it("keeps blank as blank and adds https:// when the scheme is missing", () => {
    expect(normalizeLinkedInUrl("")).toBe("");
    expect(normalizeLinkedInUrl("linkedin.com/in/jane")).toBe("https://linkedin.com/in/jane");
    expect(normalizeLinkedInUrl("www.linkedin.com/in/jane")).toBe("https://www.linkedin.com/in/jane");
  });

  it("accepts linkedin.com, www.linkedin.com and regional subdomains, in any case", () => {
    expect(normalizeLinkedInUrl("https://www.linkedin.com/in/jane")).toBe("https://www.linkedin.com/in/jane");
    expect(normalizeLinkedInUrl("https://uk.linkedin.com/in/jane")).toBe("https://uk.linkedin.com/in/jane");
    expect(normalizeLinkedInUrl("HTTPS://WWW.LinkedIn.com/in/jane")).toBe("https://www.linkedin.com/in/jane");
  });

  it("rejects other hosts and look-alikes", () => {
    expect(normalizeLinkedInUrl("https://github.com/jane")).toBeNull();
    expect(normalizeLinkedInUrl("https://linkedin.com.evil.example/in/jane")).toBeNull();
    expect(normalizeLinkedInUrl("https://notlinkedin.com/in/jane")).toBeNull();
    expect(normalizeLinkedInUrl("https://evil.example/linkedin.com/in/jane")).toBeNull();
    expect(normalizeLinkedInUrl("https://linkedin.com@evil.example/in/jane")).toBeNull();
    expect(normalizeLinkedInUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("Game Regulations details (v4) and legacy rows", () => {
  const grForm: StaffApplicationFormData = {
    ...validForm,
    role: GAME_REGULATIONS_ROLE,
    gameDirector: "  Teamfight Tactics, and some VALORANT. I help run our school's TFT ladder.  ",
  };

  it("records the trimmed answer only when Game Regulations is the role", () => {
    expect(buildStaffApplicationDetails(grForm).gameDirector).toBe(
      "Teamfight Tactics, and some VALORANT. I help run our school's TFT ladder.",
    );
    expect(buildStaffApplicationDetails({ ...grForm, role: "Legal Division" }).gameDirector).toBe("");
  });

  it("shows the answer first in admin/CSV rows as plain text", () => {
    const answer = '<b>VALORANT</b>, "LoL" & TFT\nline two';
    const rows = formatStaffApplicationDetails(buildStaffApplicationDetails({ ...grForm, gameDirector: answer }));
    expect(rows[0]).toEqual({ label: "Game Director Interest", value: answer });
  });

  it("omits the game director row for other divisions", () => {
    const rows = formatStaffApplicationDetails(buildStaffApplicationDetails(validForm));
    expect(rows.map((r) => r.label)).not.toContain("Game Director Interest");
  });

  it("still formats v3 rows (submitted before the Game Regulations change)", () => {
    const v3: StaffApplicationDetailsV3 = {
      version: 3,
      preferredFirstName: "",
      discordTag: "",
      linkedin: "",
      workSamples: "",
      availability: "5hrs",
      consent: { agreedToTerms: true, agreedToPrivacy: true, acknowledgedUnpaidVolunteer: true },
      backgroundMotivation: "Love VALORANT.",
    };
    const rows = formatStaffApplicationDetails(v3);
    expect(rows).toContainEqual({ label: "Why EZ Esports", value: "Love VALORANT." });
    expect(rows.map((r) => r.label)).not.toContain("Game Director Interest");
  });
});

describe("free-text limits", () => {
  it("checks the why-join answer: trimmed, non-empty, at most 1,500 characters", () => {
    expect(WHY_JOIN_MAX_LENGTH).toBe(1500);
    expect(checkWhyJoinAnswer("I want to help run events.")).toBeNull();
    expect(checkWhyJoinAnswer("  ")).toBe("Please tell us why you want to join EZ Esports.");
    expect(checkWhyJoinAnswer("x".repeat(1500))).toBeNull();
    expect(checkWhyJoinAnswer("x".repeat(1501))).toBe("Your answer must be 1,500 characters or fewer.");
  });

  it("formats the limit notice shown in each field's description", () => {
    expect(characterLimitNotice(500)).toBe("Up to 500 characters.");
    expect(characterLimitNotice(1000)).toBe("Up to 1,000 characters.");
    expect(characterLimitNotice(WHY_JOIN_MAX_LENGTH)).toBe("Up to 1,500 characters.");
  });
});
