/**
 * Student ID photo rules (spec-056). Pure and shared by the wizard (early feedback) and the upload route
 * (the authoritative check). The photo is sensitive PII of minors: it is stored only in the private
 * `student-ids` bucket and read only through short-lived signed URLs minted for authorized staff.
 */

/** Private Supabase Storage bucket. Never public, never given storage policies; service role only. */
export const STUDENT_ID_BUCKET = 'student-ids';

/**
 * 4 MB rather than 5 MB: the whole multipart request has to fit under Vercel's 4.5 MB serverless
 * request-body limit or the platform rejects it before the route runs. The wizard also downsizes photos
 * in the browser before upload, so phone photos normally arrive well under this.
 */
export const STUDENT_ID_MAX_BYTES = 4 * 1024 * 1024;
export const STUDENT_ID_MAX_BODY_BYTES = STUDENT_ID_MAX_BYTES + 64 * 1024;

/**
 * JPEG, PNG and WebP only. HEIC/HEIF is deliberately not accepted: browsers cannot decode it for the
 * staff preview, and iOS Safari converts a picked HEIC photo to JPEG when the input lists these types.
 */
export const STUDENT_ID_ACCEPT = 'image/jpeg,image/png,image/webp';

/** How long staff's signed link stays valid: long enough to open the image, short enough that a copied link dies. */
export const STUDENT_ID_SIGNED_URL_TTL_SECONDS = 120;

export type StudentIdType = 'image/jpeg' | 'image/png' | 'image/webp';

const EXTENSION: Record<StudentIdType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * The real image type from the file's leading bytes, or null. The Content-Type header and the file
 * name are both browser-controlled, so neither is ever consulted.
 */
export function detectImageType(bytes: Uint8Array): StudentIdType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= png.length && png.every((b, i) => bytes[i] === b)) return 'image/png';
  // WebP: "RIFF" <4-byte size> "WEBP"
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

export function formatMegabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
}

export const STUDENT_ID_TOO_LARGE_MESSAGE = `Your photo must be ${formatMegabytes(STUDENT_ID_MAX_BYTES)} or smaller.`;
export const STUDENT_ID_TYPE_MESSAGE = 'Please upload a JPEG, PNG or WebP photo of your student ID.';
export const STUDENT_ID_REQUIRED_MESSAGE =
  'Please upload a clear photo of your student ID. It is required to confirm you are a current NYC student.';

/** Cheap browser-side checks on metadata only. The server repeats them and checks the bytes. */
export function checkStudentIdFile(file: { size: number; type: string } | null | undefined): string | null {
  if (!file) return STUDENT_ID_REQUIRED_MESSAGE;
  if (file.size === 0) return 'That file is empty. Please choose a photo of your student ID.';
  if (file.type && !STUDENT_ID_ACCEPT.split(',').includes(file.type)) return STUDENT_ID_TYPE_MESSAGE;
  if (file.size > STUDENT_ID_MAX_BYTES) return STUDENT_ID_TOO_LARGE_MESSAGE;
  return null;
}

/** Full server-side validation on the actual bytes. Returns the verified type, or an error message. */
export function validateStudentIdBytes(
  bytes: Uint8Array
): { ok: true; type: StudentIdType } | { ok: false; error: string } {
  if (bytes.length === 0) return { ok: false, error: 'That file is empty. Please choose a photo of your student ID.' };
  if (bytes.length > STUDENT_ID_MAX_BYTES) return { ok: false, error: STUDENT_ID_TOO_LARGE_MESSAGE };
  const type = detectImageType(bytes);
  if (!type) return { ok: false, error: STUDENT_ID_TYPE_MESSAGE };
  return { ok: true, type };
}

/**
 * Object key: `<random uuid>.<ext from the detected type>`. Nothing from the user (name, member, invite)
 * is in the key, so it reveals and guesses nothing.
 */
export function buildStudentIdStorageKey(uuid: string, type: StudentIdType): string {
  return `${uuid}.${EXTENSION[type]}`;
}

const KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

/** True for a key this module could have produced; used as a guard before any storage call. */
export function isStudentIdStorageKey(key: unknown): key is string {
  return typeof key === 'string' && KEY_PATTERN.test(key);
}
