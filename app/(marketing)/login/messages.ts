// Allowlist of known message keys to fixed display strings — prevents arbitrary
// text from ?message= being reflected into the page (open redirect / XSS vector).
// Lives outside page.tsx because Next.js only allows a fixed set of exports from a page file.
export const MESSAGE_MAP: Record<string, string> = {
  'account-created': 'Account created. Please sign in.',
};
