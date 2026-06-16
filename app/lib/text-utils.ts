/**
 * Shared text/string utilities. Keep these pure and side-effect-free so they
 * can be imported in both server actions and client components, and are trivial
 * to unit-test.
 */

// Intentional behavior change from prior version: non-alphanumeric characters and underscores are normalized to hyphens.
/** URL-safe slug from arbitrary text. */
export function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  // All-non-alphanumeric input slugifies to ''. Use a UUID fragment instead of
  // Date.now() so concurrent requests always produce distinct, stable values.
  return base || `school-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Sanitize a URL so only http(s) schemes reach an anchor href.
 * Anything else (javascript:, data:, ftp:, …) is blanked out.
 */
export function safeUrl(url: string): string {
  const trimmed = url?.trim();
  if (!trimmed) return '';
  // Already an http(s) URL — keep as-is.
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // Reject any other explicit scheme (javascript:, data:, mailto:, …) for safety.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return '';
  // Reject absolute/relative paths — these are not external links.
  if (trimmed.startsWith('/') || trimmed.startsWith('.')) return '';
  // Bare domain like "example.com" or "example.com/path" → assume https so the
  // stored value is an absolute external link rather than being silently dropped.
  if (/^[\w-]+(\.[\w-]+)+/.test(trimmed)) return `https://${trimmed}`;
  return '';
}

/**
 * Lightweight email shape check for invite/allowlist flows. Not RFC-exhaustive
 * by design — it rejects obvious garbage (no `@`, whitespace, missing TLD) while
 * staying permissive; Supabase Auth is the ultimate validator on account create.
 */
export function isValidEmail(value: string): boolean {
  const v = value?.trim();
  if (!v || v.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/**
 * Map a raw DB/runtime error to a safe user-facing message.
 * Postgres error codes are exposed via the `code` property on the thrown error.
 *
 * Callers should still log the original error server-side before calling this.
 */
export function sanitizeDbError(error: unknown): string {
  const code = (error as Record<string, unknown>)?.code as string | undefined;
  switch (code) {
    case '23505': // unique_violation
      return 'A record with this information already exists.';
    case '23503': // foreign_key_violation
      return 'This record is linked to other data and cannot be removed yet.';
    case '23502': // not_null_violation
      return 'A required field is missing.';
    case '23514': // check_violation
      return 'The submitted data does not meet validation requirements.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}
