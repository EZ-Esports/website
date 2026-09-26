/**
 * Resume attachment rules for the public staff application.
 *
 * Shared by the browser form (early, friendly feedback) and the
 * /api/apply/staff route (the authoritative check). Kept free of server-only
 * imports so the client bundle can use it.
 */

/**
 * Private Supabase Storage bucket holding applicant resumes. Must NOT be
 * public: resumes are PII submitted through an unauthenticated form, and the
 * only read path is a short-lived signed URL minted for staff with
 * MANAGE_APPLICATIONS. Deliberately separate from the public `admin-uploads`
 * bucket used for site imagery.
 */
export const STAFF_RESUME_BUCKET = 'staff-resumes';

/**
 * 4 MB rather than a rounder 5 MB: the whole multipart request (resume plus
 * form fields) has to fit under Vercel's 4.5 MB serverless request-body
 * limit, or the platform rejects it before the route ever runs and the
 * applicant sees a generic failure instead of a size message.
 */
export const RESUME_MAX_BYTES = 4 * 1024 * 1024;

/** Upper bound for the whole multipart body, leaving room for the text fields. */
export const STAFF_APPLICATION_MAX_BODY_BYTES = RESUME_MAX_BYTES + 256 * 1024;

/** How long an admin's resume link stays valid. Long enough to open it, short enough that a leaked link dies quickly. */
export const RESUME_SIGNED_URL_TTL_SECONDS = 60;

export const RESUME_ACCEPT = 'application/pdf,.pdf';

/** Every PDF begins with this header; checked on the bytes because MIME type and extension are both client-controlled. */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

export function hasPdfMagicBytes(bytes: Uint8Array): boolean {
  if (bytes.length < PDF_MAGIC.length) return false;
  return PDF_MAGIC.every((b, i) => bytes[i] === b);
}

export interface ResumeFileLike {
  name: string;
  size: number;
  type: string;
}

/**
 * Cheap metadata checks the browser can run before upload. Returns an
 * error message, or null when the file looks acceptable. The server repeats
 * these and additionally verifies the magic bytes.
 */
export function checkResumeFile(file: ResumeFileLike | null | undefined): string | null {
  if (!file) return 'Please attach your resume as a PDF.';
  const looksLikePdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!looksLikePdf) return 'Your resume must be a PDF file.';
  if (file.size === 0) return 'That file is empty. Please choose your resume PDF.';
  if (file.size > RESUME_MAX_BYTES) return `Your resume must be ${formatBytes(RESUME_MAX_BYTES)} or smaller.`;
  return null;
}

/** Full server-side validation: metadata plus the `%PDF-` header on the actual bytes. */
export function validateResumeUpload(file: ResumeFileLike, bytes: Uint8Array): string | null {
  const metaError = checkResumeFile(file);
  if (metaError) return metaError;
  if (bytes.length > RESUME_MAX_BYTES) return `Your resume must be ${formatBytes(RESUME_MAX_BYTES)} or smaller.`;
  if (!hasPdfMagicBytes(bytes)) return 'That file is not a valid PDF. Please export your resume as a PDF and try again.';
  return null;
}

/** Storage key for a new resume: a random UUID only, so the key leaks nothing about the applicant. */
export function buildResumeStorageKey(uuid: string): string {
  return `${uuid}.pdf`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
  }
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
