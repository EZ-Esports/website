import { describe, expect, it } from "vitest";
import {
  buildStaffApplicationDetails,
  formatStaffApplicationDetails,
  type StaffApplicationFormData,
} from "@/app/lib/staff-application-form";

const validForm: StaffApplicationFormData = {
  name: "Jane Smith",
  preferredFirstName: "Janie",
  email: "jane@example.com",
  phone: "(555) 555-5555",
  discordTag: "janesmith",
  role: "Community Moderator",
  roleOther: "",
  message: "I have run a Discord community of 500 members for two years.",
  linkedin: "https://linkedin.com/in/janesmith",
  availability: "10hrs",
  agreedRules: true,
};

describe("Staff Application Details", () => {
  it("builds structured details from the form", () => {
    const details = buildStaffApplicationDetails(validForm);
    expect(details).toEqual({
      version: 1,
      preferredFirstName: "Janie",
      discordTag: "janesmith",
      linkedin: "https://linkedin.com/in/janesmith",
      availability: "10hrs",
      agreedRules: true,
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
    expect(rows).toContainEqual({ label: "Rules Agreement", value: "Agreed" });
    expect(rows).toContainEqual({
      label: "Background & Motivation",
      value: "I have run a Discord community of 500 members for two years.",
    });
  });

  it("falls back to an em dash when background & motivation is blank", () => {
    const rows = formatStaffApplicationDetails(buildStaffApplicationDetails({ ...validForm, message: "" }));
    expect(rows).toContainEqual({ label: "Background & Motivation", value: "—" });
  });

  it("degrades to a message instead of rendering garbage for an unrecognized version", () => {
    const unknown = { version: 99 } as unknown as ReturnType<typeof buildStaffApplicationDetails>;
    expect(formatStaffApplicationDetails(unknown)).toEqual([
      { label: "Details", value: "Could not display — unexpected data shape." },
    ]);
  });
});
