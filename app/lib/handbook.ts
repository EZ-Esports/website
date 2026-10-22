/**
 * Student Handbook PDF rules, shared by the admin uploader (early feedback) and
 * the server (authoritative). Free of server-only imports so the client bundle
 * can use it.
 *
 * The handbook PDF lives in the public `admin-uploads` bucket under
 * `handbook/<timestamp>.pdf`; the `page_content` row keyed
 * {@link HANDBOOK_PDF_CONTENT_KEY} stores only that storage key.
 */
import { hasPdfMagicBytes, formatBytes } from '@/app/lib/staff-resume';

export const HANDBOOK_PDF_CONTENT_KEY = 'handbook_pdf';
export const HANDBOOK_PDF_LABEL = 'Student Handbook PDF';
export const HANDBOOK_STORAGE_FOLDER = 'handbook';

/**
 * 4 MB: the whole multipart request has to fit under Vercel's 4.5 MB serverless
 * request-body limit, or the platform rejects it before the route runs and staff
 * see a generic failure instead of a size message.
 */
export const HANDBOOK_MAX_BYTES = 4 * 1024 * 1024;

export const HANDBOOK_DOWNLOAD_NAME = 'EZ-Esports-Student-Handbook.pdf';

/**
 * Largest PDF staff may pick. Anything above HANDBOOK_MAX_BYTES is shrunk in the
 * browser before upload (see handbook-compress.ts); the server still enforces
 * HANDBOOK_MAX_BYTES on what actually arrives.
 */
export const HANDBOOK_MAX_INPUT_BYTES = 50 * 1024 * 1024;

export const HANDBOOK_ACCEPT = 'application/pdf,.pdf';

const HANDBOOK_KEY_REGEX = /^handbook\/\d{10,16}\.pdf$/;

export interface HandbookFileLike {
  name: string;
  size: number;
  type: string;
}

export function buildHandbookStorageKey(timestamp: number = Date.now()): string {
  return `${HANDBOOK_STORAGE_FOLDER}/${timestamp}.pdf`;
}

/** True only for keys this feature generates; anything else is never trusted from a client. */
export function isHandbookStorageKey(key: unknown): key is string {
  return typeof key === 'string' && HANDBOOK_KEY_REGEX.test(key);
}

/** Cheap metadata checks the browser can run before upload. Returns an error message or null. */
export function checkHandbookFile(file: HandbookFileLike | null | undefined): string | null {
  if (!file) return 'Choose a PDF to upload.';
  const looksLikePdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!looksLikePdf) return 'The handbook must be a PDF file.';
  if (file.size === 0) return 'That file is empty.';
  if (file.size > HANDBOOK_MAX_BYTES) return `The handbook PDF must be ${formatBytes(HANDBOOK_MAX_BYTES)} or smaller.`;
  return null;
}

/** Browser pre-check on the picked file, before compression: type, non-empty, within the 50 MB input limit. */
export function checkHandbookSelection(file: HandbookFileLike | null | undefined): string | null {
  if (!file) return 'Choose a PDF to upload.';
  const looksLikePdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!looksLikePdf) return 'The handbook must be a PDF file.';
  if (file.size === 0) return 'That file is empty.';
  if (file.size > HANDBOOK_MAX_INPUT_BYTES) return `The handbook PDF must be ${formatBytes(HANDBOOK_MAX_INPUT_BYTES)} or smaller.`;
  return null;
}

/** Server validation: metadata plus the `%PDF-` header on the real bytes (MIME type and extension are client-controlled). */
export function validateHandbookUpload(file: HandbookFileLike, bytes: Uint8Array): string | null {
  const metaError = checkHandbookFile(file);
  if (metaError) return metaError;
  if (bytes.length > HANDBOOK_MAX_BYTES) return `The handbook PDF must be ${formatBytes(HANDBOOK_MAX_BYTES)} or smaller.`;
  if (!hasPdfMagicBytes(bytes)) return 'That file is not a valid PDF. Export it as a PDF and try again.';
  return null;
}
