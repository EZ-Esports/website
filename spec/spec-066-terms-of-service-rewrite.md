# spec-066: Terms of Service Rewrite (effective 25 Nov 2026)

Branch `feat/tos-rewrite` (unmerged). Static content only; no migration, no cache tags.

## Change
- `app/(marketing)/terms/page.tsx` is replaced wholesale with the new Terms from the approved Word document (11 sections). Wording is reproduced verbatim; the page keeps the Hero, narrow Section and existing Tailwind conventions.
- The "Last updated: September 2026" line becomes "Effective date: November 25, 2026". Section 7 still says "Last updated" (legal text kept as written).
- Material differences from the old Terms: no binding arbitration, jury-trial or class-action waiver, and no US $100 liability cap; the Released Parties release is narrowed to ordinary inherent risks (gross negligence, recklessness, willful misconduct are carved out); under-13 and guardian-authorization language replaces "Consent for minors"; the submissions license is limited to the program purpose and no longer sublicensable; new sections 9 (Accounts, Security & Access), 10 (Privacy, Cookies & Third-Party Services) and 11 (Enforcement, Notice & Survival).
- Section anchors: existing `#eligibility #conduct #events #liability #ip #disputes #changes #contact` kept; new `#accounts #privacy-third-party #enforcement`. Nothing in the repo links to `/terms#...`.
- `app/(marketing)/terms/__tests__/page.test.tsx` updated for the new headings, phrases, mailto link and anchors.

## Not changed
The onboarding consent copy (`app/lib/onboarding/consent.ts`) and apply-form checkboxes only link to `/terms` and need no edit.
