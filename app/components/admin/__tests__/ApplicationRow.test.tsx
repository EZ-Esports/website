import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ApplicationRow, { SchoolDetailsChips, type Application } from "../ApplicationRow";
import type { SchoolApplicationDetailsV3, SchoolApplicationDetailsV1 } from "@/app/lib/school-application-form";

// Mock server actions
vi.mock("@/app/(admin)/admin/applications/actions", () => ({
  updateApplicationStatus: vi.fn(),
  softDeleteSchoolApplication: vi.fn(),
}));

describe("SchoolDetailsChips", () => {
  const v3Details: SchoolApplicationDetailsV3 = {
    version: 3,
    clubStatus: "Active and returning",
    president: {
      firstName: "Simon",
      lastName: "Chen",
      gradYear: "2027",
      email: "simon@example.com",
      discord: "simon#1234",
      preferredContact: "Discord",
    },
    vicePresident: {
      firstName: "Alex",
      lastName: "Smith",
      gradYear: "2028",
      discord: "alex#5678",
      email: "alex@example.com",
      preferredContact: "Email",
    },
    thirdOfficer: {
      firstName: "Jordan",
      lastName: "Lee",
      gradYear: "2029",
      email: "jordan@example.com",
      preferredContact: "SMS",
    },
    club: {
      instagramLink: "https://instagram.com/ezclub",
      discordLink: "https://discord.gg/ezclub",
      advisorName: "Dr. Watson",
      advisorEmail: "watson@example.com",
      advisorConfirmed: "Yes",
      activeStudentsCount: "25",
      interestedGames: ["Valorant", "TETR.IO"],
      clubBarrier: "Faculty support",
      nonRosterOpportunities: ["One-day open tournaments"],
      inclusiveOpportunities: ["Friendly scrimmages"],
      separateGamingClubs: "N/A",
      contributeBeyondSchool: ["Collaborating on game rules"],
    },
    feedback: "Ready to compete!",
    consent: {
      agreedToRules: true,
      agreedToTerms: true,
      agreedToPrivacy: true,
    },
  };

  it("renders structured chips for v3 details: grad year, students, advisor, and games", () => {
    const html = renderToStaticMarkup(<SchoolDetailsChips details={v3Details} />);

    expect(html).toContain("Class &#x27;27");
    expect(html).toContain("25 students");
    expect(html).toContain("Advisor: Yes");
    expect(html).toContain("Valorant");
    expect(html).toContain("TETR.IO");
  });

  it("renders fallback chips for v1 details: divisions and school code", () => {
    const v1Details: SchoolApplicationDetailsV1 = {
      version: 1,
      preferredFirstName: "Jane",
      phone: "555-1234",
      discordTag: "jane#0001",
      schoolCode: "NYC-123",
      schoolLocation: "New York",
      howHeard: "Friend",
      linkedin: "",
      captainsCoaches: "Coach Dave",
      teamNotes: "",
      needHelpFindingPlayers: "No",
      preferredCommunicationPlatform: "Discord",
      interestedDivisions: "Varsity League",
      agreedRules: true,
      additionalNotes: "Legacy application note",
    };

    const html = renderToStaticMarkup(<SchoolDetailsChips details={v1Details} />);

    expect(html).toContain("Varsity League");
    expect(html).toContain("Code: NYC-123");
  });

  it("renders fallback dash when details is null", () => {
    const html = renderToStaticMarkup(<SchoolDetailsChips details={null} />);

    expect(html).toContain("—");
  });
});

describe("ApplicationRow", () => {
  const sampleApp: Application = {
    id: "app-uuid-1",
    applicantName: "Simon Chen",
    schoolName: "Stuyvesant High School",
    role: "Esports Club President",
    email: "simon@stuy.edu",
    details: {
      version: 3,
      clubStatus: "Active and returning",
      president: {
        firstName: "Simon",
        lastName: "Chen",
        gradYear: "2027",
        email: "simon@stuy.edu",
        discord: "simon#1234",
        preferredContact: "Discord",
      },
      vicePresident: {
        firstName: "Alex",
        lastName: "Smith",
        gradYear: "2028",
        discord: "alex#5678",
        email: "alex@example.com",
        preferredContact: "Email",
      },
      thirdOfficer: {
        firstName: "Jordan",
        lastName: "Lee",
        gradYear: "2029",
        email: "jordan@example.com",
        preferredContact: "SMS",
      },
      club: {
        instagramLink: "",
        discordLink: "",
        advisorName: "Dr. Watson",
        advisorEmail: "watson@stuy.edu",
        advisorConfirmed: "Yes",
        activeStudentsCount: "40",
        interestedGames: ["League of Legends", "Valorant"],
        clubBarrier: "",
        nonRosterOpportunities: [],
        inclusiveOpportunities: [],
        separateGamingClubs: "N/A",
        contributeBeyondSchool: [],
      },
      feedback: "",
      consent: {
        agreedToRules: true,
        agreedToTerms: true,
        agreedToPrivacy: true,
      },
    },
    status: "pending",
    submittedAt: new Date("2026-09-01T12:00:00Z"),
  };

  it("renders table row with structured chips and no legacy message", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <ApplicationRow app={sampleApp} />
        </tbody>
      </table>
    );

    expect(html).toContain("Simon Chen");
    expect(html).toContain("Stuyvesant High School");
    expect(html).toContain("Class &#x27;27");
    expect(html).toContain("40 students");
    expect(html).toContain("Advisor: Yes");
    expect(html).toContain("League of Legends");
    expect(html).toContain("Valorant");
    expect(html).toContain("View");
  });
});
