import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import StaffApplicationRow, { StaffDetailsChips, type StaffApplication } from "../StaffApplicationRow";
import type { StaffApplicationDetailsV2 } from "@/app/lib/staff-application-form";

// Mock server actions
vi.mock("@/app/(admin)/admin/applications/actions", () => ({
  updateStaffApplicationStatus: vi.fn(),
  softDeleteStaffApplication: vi.fn(),
}));

describe("StaffDetailsChips", () => {
  const sampleDetails: StaffApplicationDetailsV2 = {
    version: 2,
    preferredFirstName: "Alex",
    discordTag: "alex#9999",
    linkedin: "https://linkedin.com/in/alexesports",
    availability: "15 hrs/week",
    consent: {
      agreedToTerms: true,
      agreedToPrivacy: true,
    },
    backgroundMotivation: "Passionate about high school esports production and tournament operations.",
  };

  it("renders availability badge, LinkedIn link, Discord tag, and motivation excerpt", () => {
    const html = renderToStaticMarkup(<StaffDetailsChips details={sampleDetails} />);

    expect(html).toContain("15 hrs/week");
    expect(html).toContain("href=\"https://linkedin.com/in/alexesports\"");
    expect(html).toContain("LinkedIn ↗");
    expect(html).toContain("alex#9999");
    expect(html).toContain("Passionate about high school esports");
  });

  it("renders fallback dash when details is null", () => {
    const html = renderToStaticMarkup(<StaffDetailsChips details={null} />);

    expect(html).toContain("—");
  });
});

describe("StaffApplicationRow", () => {
  const sampleApp: StaffApplication = {
    id: "staff-uuid-1",
    name: "Alex Morgan",
    preferredFirstName: "Alex",
    email: "alex@example.com",
    phone: "555-0199",
    discordTag: "alex#9999",
    role: "Productions Crew",
    hasResume: false,
    details: {
      version: 2,
      preferredFirstName: "Alex",
      discordTag: "alex#9999",
      linkedin: "https://linkedin.com/in/alexesports",
      availability: "15 hrs/week",
      consent: {
        agreedToTerms: true,
        agreedToPrivacy: true,
      },
      backgroundMotivation: "Passionate about high school esports production and tournament operations.",
    },
    status: "accepted",
    submittedAt: new Date("2026-09-02T15:00:00Z"),
  };

  it("renders staff row with structured details chips and View button", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <StaffApplicationRow app={sampleApp} />
        </tbody>
      </table>
    );

    expect(html).toContain("Alex Morgan");
    expect(html).toContain("Productions Crew");
    expect(html).toContain("alex@example.com");
    expect(html).toContain("555-0199");
    expect(html).toContain("15 hrs/week");
    expect(html).toContain("LinkedIn ↗");
    expect(html).toContain("View");
  });
});
