import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ExportCsvButton from "../ExportCsvButton";

vi.mock("@/app/lib/csv-download", () => ({
  downloadCsv: vi.fn(),
}));

describe("ExportCsvButton", () => {
  it("renders default export button with action and status props", () => {
    const mockAction = vi.fn().mockResolvedValue("col1,col2\nval1,val2");
    const html = renderToStaticMarkup(
      <ExportCsvButton
        action={mockAction}
        status="pending"
        filename="staff-applications-pending.csv"
        label="Export Pending Staff"
      />
    );

    expect(html).toContain("Export Pending Staff");
    expect(html).toContain("<button");
  });

  it("renders custom label and className", () => {
    const mockAction = vi.fn().mockResolvedValue("");
    const html = renderToStaticMarkup(
      <ExportCsvButton
        action={mockAction}
        filename="test.csv"
        label="Download Custom"
        className="custom-btn-class"
      />
    );

    expect(html).toContain("Download Custom");
    expect(html).toContain("custom-btn-class");
  });

  it("supports legacy fetchCsv prop", () => {
    const mockFetch = vi.fn().mockResolvedValue("");
    const html = renderToStaticMarkup(
      <ExportCsvButton
        fetchCsv={mockFetch}
        filename="test.csv"
      />
    );

    expect(html).toContain("Export CSV");
  });
});
