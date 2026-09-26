import { describe, expect, it } from "vitest";
import {
  RESUME_MAX_BYTES,
  STAFF_APPLICATION_MAX_BODY_BYTES,
  STAFF_RESUME_BUCKET,
  buildResumeStorageKey,
  checkResumeFile,
  formatBytes,
  hasPdfMagicBytes,
  validateResumeUpload,
} from "@/app/lib/staff-resume";

const enc = (s: string) => new TextEncoder().encode(s);
const pdfBytes = enc("%PDF-1.7\n%âãÏÓ\n1 0 obj\n");
const pdfFile = { name: "Jane Smith Resume.pdf", size: pdfBytes.length, type: "application/pdf" };

describe("staff resume validation", () => {
  it("uses the private staff-resumes bucket, never the public admin-uploads one", () => {
    expect(STAFF_RESUME_BUCKET).toBe("staff-resumes");
  });

  it("caps the resume below Vercel's 4.5 MB request body limit", () => {
    expect(RESUME_MAX_BYTES).toBe(4 * 1024 * 1024);
    expect(STAFF_APPLICATION_MAX_BODY_BYTES).toBeLessThan(4.5 * 1024 * 1024);
  });

  it("recognizes the %PDF- header", () => {
    expect(hasPdfMagicBytes(pdfBytes)).toBe(true);
    expect(hasPdfMagicBytes(enc("%PDF"))).toBe(false);
    expect(hasPdfMagicBytes(enc("PK\u0003\u0004 docx"))).toBe(false);
    expect(hasPdfMagicBytes(enc(" %PDF-1.7"))).toBe(false);
    expect(hasPdfMagicBytes(new Uint8Array())).toBe(false);
  });

  it("requires a file", () => {
    expect(checkResumeFile(null)).toBe("Please attach your resume as a PDF.");
    expect(checkResumeFile(undefined)).toBe("Please attach your resume as a PDF.");
  });

  it("accepts a PDF by MIME type or by extension (some browsers send an empty type)", () => {
    expect(checkResumeFile(pdfFile)).toBeNull();
    expect(checkResumeFile({ ...pdfFile, type: "" })).toBeNull();
    expect(checkResumeFile({ ...pdfFile, name: "resume", type: "application/pdf" })).toBeNull();
  });

  it("rejects non-PDF, empty and oversized files with clear messages", () => {
    expect(checkResumeFile({ name: "resume.docx", size: 10, type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }))
      .toBe("Your resume must be a PDF file.");
    expect(checkResumeFile({ ...pdfFile, size: 0 })).toBe("That file is empty. Please choose your resume PDF.");
    expect(checkResumeFile({ ...pdfFile, size: RESUME_MAX_BYTES })).toBeNull();
    expect(checkResumeFile({ ...pdfFile, size: RESUME_MAX_BYTES + 1 })).toBe("Your resume must be 4 MB or smaller.");
  });

  it("server check trusts the bytes, not the claimed type or extension", () => {
    expect(validateResumeUpload(pdfFile, pdfBytes)).toBeNull();
    const disguised = enc("<html><script>alert(1)</script>");
    expect(validateResumeUpload({ ...pdfFile, size: disguised.length }, disguised)).toBe(
      "That file is not a valid PDF. Please export your resume as a PDF and try again.",
    );
  });

  it("server check rejects oversized bytes even when the reported size lies", () => {
    const big = new Uint8Array(RESUME_MAX_BYTES + 1);
    big.set(enc("%PDF-"));
    expect(validateResumeUpload({ ...pdfFile, size: 10 }, big)).toBe("Your resume must be 4 MB or smaller.");
  });

  it("builds a storage key from the UUID alone", () => {
    expect(buildResumeStorageKey("0b6f8a2e-4f1c-4a8e-9a53-0d1b2c3d4e5f")).toBe(
      "0b6f8a2e-4f1c-4a8e-9a53-0d1b2c3d4e5f.pdf",
    );
  });

  it("formats sizes for the filename chip", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
    expect(formatBytes(4 * 1024 * 1024)).toBe("4 MB");
  });
});
