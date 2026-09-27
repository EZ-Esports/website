import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ApplicationDetailModal from "../ApplicationDetailModal";
import StaffApplicationDetailModal from "../StaffApplicationDetailModal";
import type { Application } from "../ApplicationRow";
import type { StaffApplication } from "../StaffApplicationRow";

// Mock Overlay/Modal/Dialog primitives to render inline for static markup
vi.mock("@/app/components/ui/overlay", () => ({
  Overlay: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) => (isOpen ? <div>{children}</div> : null),
  Modal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Dialog: ({ children, "aria-label": label }: { children: React.ReactNode; "aria-label"?: string }) => (
    <div role="dialog" aria-label={label}>
      {children}
    </div>
  ),
}));

describe("ApplicationDetailModal", () => {
  const schoolApp: Application = {
    id: "app-1",
    applicantName: "Jane Doe",
    schoolName: "Midwood High School",
    role: "Esports Club President",
    email: "jane@midwood.edu",
    status: "pending",
    submittedAt: new Date("2026-09-10T10:00:00Z"),
    details: {
      version: 3,
      clubStatus: "Brand new club",
      president: {
        firstName: "Jane",
        lastName: "Doe",
        gradYear: "2027",
        email: "jane@midwood.edu",
        discord: "janedoe#0001",
        preferredContact: "Discord",
      },
      vicePresident: {
        firstName: "John",
        lastName: "Smith",
        gradYear: "2028",
        discord: "john#0002",
        email: "john@midwood.edu",
        preferredContact: "Email",
      },
      thirdOfficer: {
        firstName: "Sam",
        lastName: "Wilson",
        gradYear: "2029",
        email: "sam@midwood.edu",
        preferredContact: "SMS",
      },
      club: {
        instagramLink: "https://instagram.com/midwoodesports",
        discordLink: "https://discord.gg/midwoodesports",
        advisorName: "Ms. Frizzle",
        advisorEmail: "frizzle@midwood.edu",
        advisorConfirmed: "Yes",
        activeStudentsCount: "35",
        interestedGames: ["Valorant", "osu!"],
        clubBarrier: "Recruiting players",
        nonRosterOpportunities: ["Casting or production"],
        inclusiveOpportunities: ["Friendly scrimmages"],
        separateGamingClubs: "N/A",
        contributeBeyondSchool: ["Collaborating on game rules"],
      },
      feedback: "Looking forward to matches!",
      consent: {
        agreedToRules: true,
        agreedToTerms: true,
        agreedToPrivacy: true,
      },
    },
  };

  it("renders sectioned view with President, Vice President, Club Info, and Consent", () => {
    const html = renderToStaticMarkup(
      <ApplicationDetailModal app={schoolApp} isOpen={true} onOpenChange={() => {}} />
    );

    expect(html).toContain("Jane Doe");
    expect(html).toContain("Midwood High School");
    expect(html).toContain("President");
    expect(html).toContain("Vice President");
    expect(html).toContain("3rd Club Officer");
    expect(html).toContain("Club Info");
    expect(html).toContain("Ms. Frizzle");
    expect(html).toContain("Valorant, osu!");
    expect(html).toContain("League Rules &amp; Code of Conduct");
    expect(html).toContain("Agreed");
  });

  it("renders empty state notice when details is null", () => {
    const appWithoutDetails: Application = {
      ...schoolApp,
      details: null,
    };

    const html = renderToStaticMarkup(
      <ApplicationDetailModal app={appWithoutDetails} isOpen={true} onOpenChange={() => {}} />
    );

    expect(html).toContain("No details were submitted with this application.");
  });
});

describe("StaffApplicationDetailModal", () => {
  const staffApp: StaffApplication = {
    id: "staff-1",
    name: "Robin Banks",
    preferredFirstName: "Robin",
    email: "robin@example.com",
    phone: "555-4321",
    discordTag: "robin#1111",
    role: "Marketing Division",
    hasResume: false,
    status: "accepted",
    submittedAt: new Date("2026-09-12T14:00:00Z"),
    details: {
      version: 2,
      preferredFirstName: "Robin",
      discordTag: "robin#1111",
      linkedin: "https://linkedin.com/in/robinbanks",
      availability: "10 hrs/week",
      consent: {
        agreedToTerms: true,
        agreedToPrivacy: true,
      },
      backgroundMotivation: "Experienced social media manager and tournament graphic designer.",
    },
  };

  it("renders sectioned view with Applicant Profile, Role & Availability, and Agreements", () => {
    const html = renderToStaticMarkup(
      <StaffApplicationDetailModal app={staffApp} isOpen={true} onOpenChange={() => {}} />
    );

    expect(html).toContain("Robin Banks");
    expect(html).toContain("Applicant Profile");
    expect(html).toContain("Role &amp; Availability");
    expect(html).toContain("Background &amp; Motivation");
    expect(html).toContain("Consent");
    expect(html).toContain("10 hrs/week");
    expect(html).toContain("https://linkedin.com/in/robinbanks");
    expect(html).toContain("Terms of Service");
    expect(html).toContain("Agreed");
  });

  it("renders empty state notice when details is null", () => {
    const appWithoutDetails: StaffApplication = {
      ...staffApp,
      details: null,
    };

    const html = renderToStaticMarkup(
      <StaffApplicationDetailModal app={appWithoutDetails} isOpen={true} onOpenChange={() => {}} />
    );

    expect(html).toContain("No details were submitted with this application.");
  });
});
