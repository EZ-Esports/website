import { describe, expect, it } from "vitest";
import {
  buildStaffApplicationDetails,
  formatStaffApplicationDetails,
  isStaffRole,
  STAFF_ROLES,
  type StaffRole,
  type StaffApplicationDetailsV1,
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
  availability: "10hrs",
  agreedToTerms: true,
  agreedToPrivacy: true,
};

describe("Staff Application Details", () => {
  it("builds structured details from the form", () => {
    const details = buildStaffApplicationDetails(validForm);
    expect(details).toEqual({
      version: 2,
      preferredFirstName: "Janie",
      discordTag: "janesmith",
      linkedin: "https://linkedin.com/in/janesmith",
      availability: "10hrs",
      consent: { agreedToTerms: true, agreedToPrivacy: true },
      backgroundMotivation: "I have run a Discord community of 500 members for two years.",
    });
  });

  it("captures the background & motivation textarea into details", () => {
    const details = buildStaffApplicationDetails({ ...validForm, message: "  Some padded answer.  " });
    expect(details.backgroundMotivation).toBe("Some padded answer.");
  });

  it("formats details into labeled rows", () => {
    const rows = formatStaffApplicationDetails(buildStaffApplicationDetails(validForm));
    expect(rows).toContainEqual({ label: "Weekly Availability", value: "10hrs" });
    expect(rows).toContainEqual({ label: "Terms of Service", value: "Agreed" });
    expect(rows).toContainEqual({ label: "Privacy Policy", value: "Agreed" });
    expect(rows).toContainEqual({
      label: "Background & Motivation",
      value: "I have run a Discord community of 500 members for two years.",
    });
  });

  it("falls back to an em dash when background & motivation is blank", () => {
    const rows = formatStaffApplicationDetails(buildStaffApplicationDetails({ ...validForm, message: "" }));
    expect(rows).toContainEqual({ label: "Background & Motivation", value: "—" });
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
