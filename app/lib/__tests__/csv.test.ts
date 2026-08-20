import { describe, expect, it } from "vitest";
import { escapeCsvField, toCsvRow, buildCsv } from "@/app/lib/csv";

describe("csv helpers", () => {
  it("leaves plain values unescaped", () => {
    expect(escapeCsvField("plain value")).toBe("plain value");
  });

  it("wraps values containing a comma in quotes", () => {
    expect(escapeCsvField("Smith, Jane")).toBe("\"Smith, Jane\"");
  });

  it("wraps and doubles embedded double quotes", () => {
    expect(escapeCsvField("She said \"hi\"")).toBe("\"She said \"\"hi\"\"\"");
  });

  it("wraps values containing a newline", () => {
    expect(escapeCsvField("line one\nline two")).toBe("\"line one\nline two\"");
  });

  it("wraps values containing a carriage return", () => {
    expect(escapeCsvField("line one\r\nline two")).toBe("\"line one\r\nline two\"");
  });

  it("does not wrap a value that only contains ordinary punctuation", () => {
    expect(escapeCsvField("Grade 9-12 (approx.)")).toBe("Grade 9-12 (approx.)");
  });

  it("joins fields into a row, escaping each field independently", () => {
    expect(toCsvRow(["Jane Doe", "Smith, Jane", "plain"])).toBe(
      "Jane Doe,\"Smith, Jane\",plain"
    );
  });

  it("builds a full csv from a header and rows with CRLF line endings", () => {
    const csv = buildCsv(
      ["Name", "Notes"],
      [
        ["Jane", "Likes commas, apparently"],
        ["Alex", "No notes"],
      ]
    );
    expect(csv).toBe(
      "Name,Notes\r\nJane,\"Likes commas, apparently\"\r\nAlex,No notes"
    );
  });
});
