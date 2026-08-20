import { describe, expect, it } from "vitest";
import {
  buildStaffApplicationDetails,
  formatStaffApplicationDetails,
  parseStaffApplicationMessage,
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

function compileMessage(form: StaffApplicationFormData): string {
  return `
Preferred first name: ${form.preferredFirstName || 'N/A'}
Phone number: ${form.phone || 'N/A'}
Discord tag: ${form.discordTag || 'N/A'}
LinkedIn / Portfolio: ${form.linkedin || 'N/A'}
Weekly availability: ${form.availability}

Background & Motivation:
${form.message}
`.trim();
}

describe("Staff Application Details", () => {
  it("builds structured details from the form", () => {
    const details = buildStaffApplicationDetails(validForm);
    expect(details).toEqual({
      preferredFirstName: "Janie",
      discordTag: "janesmith",
      linkedin: "https://linkedin.com/in/janesmith",
      availability: "10hrs",
      agreedRules: true,
    });
  });

  it("formats details into labeled rows", () => {
    const rows = formatStaffApplicationDetails(buildStaffApplicationDetails(validForm));
    expect(rows).toContainEqual({ label: "Weekly Availability", value: "10hrs" });
    expect(rows).toContainEqual({ label: "Rules Agreement", value: "Agreed" });
  });

  it("parses a compiled message back into the same structured details", () => {
    const message = compileMessage(validForm);
    expect(parseStaffApplicationMessage(message)).toEqual(buildStaffApplicationDetails(validForm));
  });

  it("undoes the 'N/A' placeholder for empty optional fields", () => {
    const sparseForm = { ...validForm, preferredFirstName: "", discordTag: "", linkedin: "" };
    const message = compileMessage(sparseForm);
    expect(parseStaffApplicationMessage(message)).toEqual({
      preferredFirstName: "",
      discordTag: "",
      linkedin: "",
      availability: "10hrs",
      agreedRules: true,
    });
  });

  it("returns null when a message doesn't match the known template", () => {
    expect(parseStaffApplicationMessage("some unrelated legacy free text")).toBeNull();
    expect(parseStaffApplicationMessage("")).toBeNull();
  });
});
