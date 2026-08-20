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

  it("prefixes a leading '=' with an apostrophe to defuse formula injection", () => {
    expect(escapeCsvField('=HYPERLINK("https://evil.example","click")')).toBe(
      "\"'=HYPERLINK(\"\"https://evil.example\"\",\"\"click\"\")\""
    );
  });

  it("prefixes other formula-trigger leading characters ('+', '-', '@')", () => {
    expect(escapeCsvField("+1+1")).toBe("'+1+1");
    expect(escapeCsvField("-1+1")).toBe("'-1+1");
    expect(escapeCsvField("@SUM(1,1)")).toBe("\"'@SUM(1,1)\"");
  });

  it("does not touch a value that merely contains a formula-trigger character mid-string", () => {
    expect(escapeCsvField("Class of 9-12")).toBe("Class of 9-12");
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
