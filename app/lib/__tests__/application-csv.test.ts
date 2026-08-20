import { describe, expect, it } from "vitest";
import { schoolApplicationsToCsv, staffApplicationsToCsv } from "@/app/lib/application-csv";
import type { SchoolApplicationDetailsV2 } from "@/app/lib/school-application-form";
import type { StaffApplicationDetailsV1 } from "@/app/lib/staff-application-form";

const schoolDetails: SchoolApplicationDetailsV2 = {
  version: 2,
  clubStatus: "Active and returning",
  president: { firstName: "Jane", lastName: "Doe", gradYear: "27", email: "jane@example.com", discord: "janedoe", preferredContact: "Discord" },
  vicePresident: { firstName: "Alex", lastName: "Smith", gradYear: "28", discord: "alexsmith", email: "alex@example.com", preferredContact: "Email" },
  thirdOfficer: { firstName: "Jordan", lastName: "Lee", gradYear: "29", email: "jordan@example.com", preferredContact: "SMS" },
  club: {
    instagramLink: "https://instagram.com/example",
    discordLink: "https://discord.gg/example",
    advisorName: "Mr. Davis",
    advisorEmail: "davis@schools.nyc.gov",
    advisorConfirmed: "Yes",
    activeStudentsCount: "30",
    interestedGames: ["Valorant"],
    clubBarrier: "Recruiting players",
    nonRosterOpportunities: ["One-day open tournaments"],
    inclusiveOpportunities: ["Friendly scrimmages"],
    separateGamingClubs: "N/A",
    contributeBeyondSchool: ["Not at this time"],
  },
  feedback: "Excited for the season!",
  agreedRules: true,
};

const staffDetails: StaffApplicationDetailsV1 = {
  version: 1,
  preferredFirstName: "Jamie",
  discordTag: "jamie#0001",
  linkedin: "https://linkedin.com/in/example",
  availability: "10 hrs/week",
  agreedRules: true,
};

describe("schoolApplicationsToCsv", () => {
  it("uses the formatted details text, not the raw message, when details is present", () => {
    const csv = schoolApplicationsToCsv([
      {
        applicantName: "Jane Doe",
        schoolName: "Brooklyn Tech",
        role: "Esports Club President",
        email: "jane@example.com",
        status: "pending",
        submittedAt: new Date("2026-01-15"),
        message: "raw legacy message text that should not appear",
        details: schoolDetails,
      },
    ]);
    expect(csv).toContain("President:");
    expect(csv).not.toContain("raw legacy message text");
  });

  it("falls back to the raw message when details is null", () => {
    const csv = schoolApplicationsToCsv([
      {
        applicantName: "Jane Doe",
        schoolName: "Brooklyn Tech",
        role: "Esports Club President",
        email: "jane@example.com",
        status: "pending",
        submittedAt: new Date("2026-01-15"),
        message: "an old, unbackfilled message blob",
        details: null,
      },
    ]);
    expect(csv).toContain("an old, unbackfilled message blob");
  });

  it("falls back to an empty details column when both details and message are null", () => {
    const csv = schoolApplicationsToCsv([
      {
        applicantName: "Jane Doe",
        schoolName: "Brooklyn Tech",
        role: "Esports Club President",
        email: "jane@example.com",
        status: "pending",
        submittedAt: new Date("2026-01-15"),
        message: null,
        details: null,
      },
    ]);
    const lines = csv.split("\r\n");
    expect(lines[1].endsWith(",")).toBe(true);
  });
});

describe("staffApplicationsToCsv", () => {
  it("uses the formatted details text, not the raw message, when details is present", () => {
    const csv = staffApplicationsToCsv([
      {
        name: "Jamie Rivera",
        role: "Broadcast Producer",
        email: "jamie@example.com",
        phone: "555-0100",
        status: "pending",
        submittedAt: new Date("2026-01-15"),
        message: "raw legacy staff message that should not appear",
        details: staffDetails,
      },
    ]);
    expect(csv).toContain("LinkedIn");
    expect(csv).not.toContain("raw legacy staff message");
  });

  it("falls back to the raw message when details is null", () => {
    const csv = staffApplicationsToCsv([
      {
        name: "Jamie Rivera",
        role: "Broadcast Producer",
        email: "jamie@example.com",
        phone: "555-0100",
        status: "pending",
        submittedAt: new Date("2026-01-15"),
        message: "an old, unbackfilled staff message",
        details: null,
      },
    ]);
    expect(csv).toContain("an old, unbackfilled staff message");
  });
});
