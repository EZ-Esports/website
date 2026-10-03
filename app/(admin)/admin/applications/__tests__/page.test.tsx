import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ApplicationsAdminPage from "../page";

// Mock auth module
vi.mock("@/app/lib/auth", () => ({
  getStaffForAdminSection: vi.fn(),
}));

// Mock DB queries
vi.mock("@/app/lib/db/queries", () => ({
  getSchoolApplications: vi.fn(),
  getStaffApplications: vi.fn(),
}));

// Mock server actions
vi.mock("../actions", () => ({
  exportSchoolApplicationsCsv: Object.assign(vi.fn(), { $$typeof: Symbol.for("react.server.reference") }),
  exportStaffApplicationsCsv: Object.assign(vi.fn(), { $$typeof: Symbol.for("react.server.reference") }),
  updateApplicationStatus: vi.fn(),
  updateStaffApplicationStatus: vi.fn(),
  softDeleteSchoolApplication: vi.fn(),
  softDeleteStaffApplication: vi.fn(),
}));

import { getStaffForAdminSection } from "@/app/lib/auth";
import { getSchoolApplications, getStaffApplications } from "@/app/lib/db/queries";

describe("ApplicationsAdminPage", () => {
  it("renders PermissionDenied when staff lacks access", async () => {
    vi.mocked(getStaffForAdminSection).mockResolvedValueOnce(null);

    const jsx = await ApplicationsAdminPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(jsx);

    expect(html).toContain("Permission required");
  });

  it("renders applications page with ExportCsvButton having valid action props when applications exist", async () => {
    vi.mocked(getStaffForAdminSection).mockResolvedValueOnce({
      id: "staff-1",
      email: "admin@ezesports.org",
      permissions: BigInt(0xffffffff),
      isOwner: true,
      highestRolePosition: 1,
    });

    vi.mocked(getSchoolApplications).mockResolvedValueOnce([
      {
        id: "school-app-1",
        applicantName: "School Applicant",
        schoolName: "Test High School",
        role: "Club President",
        email: "school@example.com",
        details: null,
        submittedAt: new Date("2026-09-01T12:00:00Z"),
        status: "pending",
      },
    ]);

    vi.mocked(getStaffApplications).mockResolvedValueOnce([
      {
        id: "staff-app-1",
        careerPostingId: null,
        name: "Staff Applicant",
        preferredFirstName: "Staffer",
        email: "staff@example.com",
        phone: "555-1234",
        discordTag: "staff#1234",
        role: "Productions Crew",
        details: null,
        hasResume: false,
        submittedAt: new Date("2026-09-02T12:00:00Z"),
        status: "pending",
      },
    ]);

    // Ensure DATABASE_URL is set so dbConfigured is true
    const prevDb = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";

    try {
      const jsx = await ApplicationsAdminPage({ searchParams: Promise.resolve({}) });
      const html = renderToStaticMarkup(jsx);

      expect(html).toContain("School Applications");
      expect(html).toContain("Staff Applications");
      expect(html).toContain("School Applicant");
      expect(html).toContain("Staff Applicant");
      expect(html).toContain("Export CSV");
    } finally {
      process.env.DATABASE_URL = prevDb;
    }
  });

  it("renders empty states when no applications exist", async () => {
    vi.mocked(getStaffForAdminSection).mockResolvedValueOnce({
      id: "staff-1",
      email: "admin@ezesports.org",
      permissions: BigInt(0xffffffff),
      isOwner: true,
      highestRolePosition: 1,
    });

    vi.mocked(getSchoolApplications).mockResolvedValueOnce([]);
    vi.mocked(getStaffApplications).mockResolvedValueOnce([]);

    const prevDb = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";

    try {
      const jsx = await ApplicationsAdminPage({ searchParams: Promise.resolve({}) });
      const html = renderToStaticMarkup(jsx);

      expect(html).toContain("No applications yet.");
    } finally {
      process.env.DATABASE_URL = prevDb;
    }
  });
});
