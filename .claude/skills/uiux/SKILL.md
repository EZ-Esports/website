---
name: uiux
description: UI/UX design principles and case studies for this site. Load BEFORE designing, wireframing, or restructuring any page, layout, section, or component — or when reviewing a page for design quality. Contains generic first-principles rules plus accumulated case studies of redesigns we shipped, why the old version failed, and why the new one works.
---

# UI/UX Design Principles

This skill accumulates design judgment for this project. When you touch layout or UX,
apply the generic rules below, check the case studies for precedent, and **add a new
case study whenever we ship a meaningful redesign** (what was bad → what we did → why
it's better, argued from first principles, not taste).

## Generic rules (first principles)

**1. Start from the user's job, not from available components.**
Every page has one primary job the visitor came to do (apply, read standings, watch a
match). Derive the layout from that job: the primary action should be reachable with
the least scrolling, reading, and decision-making possible. If a section doesn't help
the user complete the job or decide to commit to it, it's a candidate for deletion —
not restyling.

**2. Match the genre's mental model.**
Users arrive with expectations formed by every similar page they've seen (a checkout, a
careers application, a settings page). Deviating from the genre costs comprehension and
trust. Before designing, ask: "what does the best-in-class version of this page type
look like, and what do all of them have in common?" Copy the skeleton, not the skin.

**3. One page, one message hierarchy.**
Exactly one `h1`, one dominant visual block, one primary CTA per screen. Two elements
that both claim "I am the point of this page" split attention and read as two pages
stitched together. Marketing content and task content don't share a page as equals —
one is always subordinate.

**4. Every screenful must justify its height.**
Viewport space is the budget. A decorative element that consumes 20–35% of the first
screen must earn it (it almost never does on task pages). Compress or delete anything
the user scrolls past without reading. Corollary: content the user needs while working
(navigation, help, progress) should be sticky; content they need once should not.

**5. Progressive disclosure over walls.**
Long tasks get broken into labeled, numbered steps with visible progress. Show where
the user is, what's done, and what's left. Completion feedback (checkmarks, progress %)
converts anxiety into momentum.

**6. Boxes are for interaction, prose is for persuasion.**
Cards/boxes signal "these are parallel, interactive, or scannable units." Three boxes
holding three sentences of marketing copy is a false affordance — the reader gets card
chrome with no card behavior. Short persuasive content reads better as an inline list
or a paragraph; save boxes for things that are actually distinct units (form sections,
nav panels, products).

**7. Contrast and color have contracts.**
Text colors must meet contrast on the surface they actually sit on (a brand color
designed for dark surfaces fails on light ones — swap to the accessible variant, don't
reuse it). Interactive states (focus, error, active, complete) each get one consistent
color across the page. Never invent utility classes that don't exist in the design
system (`text-red-650`) — they silently render as nothing.

**8. Transitions between surfaces must look intentional.**
Adjacent sections with unrelated backgrounds (dark → light) read as a bug ("clipping")
unless the boundary is a deliberate structural line (the site nav, a footer). Prefer
one continuous surface per page; if two surfaces must meet, make the seam a real
element, not a raw edge.

**9. State the meta before the ask.**
Before asking a user to invest effort, tell them the cost and terms up front: how long
it takes, how many steps, where it applies, what it costs. A small meta row (📍 ⏱ 📋 💲)
under the title answers the questions that otherwise cause abandonment.

**10. Verify visually, on the rendered page.**
Layout changes are not done at "typecheck passes." Screenshot the real rendered page at
desktop width (and ideally mobile) and look at it. Check: heading hierarchy, sticky
behavior, seams between sections, and that nav/header contrast still works on this
page's background.

## Case studies

### Case study 1: /apply — from marketing sandwich to careers-style application (2026-07)

**What the page was:** a 35vh hero banner ("Bring EZ Esports to Your School" over a NYC
skyline photo) → a dark "WHY JOIN EZ ESPORTS" section with three marketing cards → a
light-pink application form section bolted on at the bottom. The form itself was a
centered heading plus four form cards with a static sidebar.

**Why it was bad, from first principles:**

- *Violated rule 1 (user's job):* everyone landing on /apply has already decided to
  apply — the nav button literally says "Apply Now." The page made them scroll past two
  full screens of persuasion aimed at a decision they'd already made. The primary
  action started ~2000px down.
- *Violated rule 2 (genre):* no serious careers/application page (Anthropic, Google,
  Stripe, any Greenhouse-hosted form) opens with a hero banner and a benefits card
  grid. The genre skeleton is: title → meta (location, time) → short description →
  form. Deviating made the page read as a landing page with a form stapled on.
- *Violated rule 3 (one hierarchy):* the hero's `h1`, the "WHY JOIN" section heading,
  and the form's "SCHOOL APPLICATION" heading each claimed to be the point. The hero
  looked like "its own section" because it *was* one — it had no relationship to the
  form below it.
- *Violated rule 6 (boxes):* three cards holding one sentence each — card chrome, no
  card content. The same information fits in three checkmark lines.
- *Violated rule 8 (seams):* dark section → light-pink section produced the "clips into
  the page" hard edge mid-scroll.
- Smaller violations: brand pink `#f4cccc` (a dark-surface color) used as text on the
  light background (rule 7); nonexistent Tailwind classes like `text-red-650` silently
  rendering as no color (rule 7).

**What we did:**

- Deleted the hero and the "Why Join" card section from `app/(marketing)/apply/page.tsx`
  entirely; the page is now just the application section, full-height, one surface.
- Folded the three value props into a three-line checkmark list inside the application
  header — persuasion subordinated to the task, not competing with it (rules 1, 3, 6).
- Rebuilt the header as a job-posting skeleton: overline → `h1` → meta chip row
  (📍 New York City · ⏱ ~5 min · 📋 5 sections · 💲 free) → description → benefits (rules 2, 9).
- Sticky left rail with scroll-spy section nav: numbered sections that highlight in
  view, turn into green checkmarks as their required fields complete, plus a live
  progress % bar (rule 5). Secondary info ("After you apply" timeline, help contact)
  lives below it, hidden on mobile.
- Form split into five numbered "Step N of 5" cards, ending with a dedicated
  "Review & Submit" step holding the terms agreement and submit button (rule 5 — consent
  and commitment at the end, like every real application flow).
- Removed `/apply` from the header's `hasHero` list (`app/components/layout/Header.tsx`)
  so the nav renders sticky with a solid dark background instead of transparent-over-image
  — the white nav text stays readable on the light page (rules 7, 8).
- Replaced light-pink accent text with the deep magenta `#b5005a` on light surfaces and
  fixed the invented Tailwind classes (rule 7).
- Verified with headless-Chrome screenshots of the rendered page at 1440px (rule 10).

**Why the result is good:** the form is on screen within one scroll; the page has one
`h1` and one job; every sidebar element serves the person *currently filling the form*
(where am I, what's left, what happens after, who do I ask); the benefits survive as
three scannable lines instead of a detour; and there are no surface seams because there
is only one surface. It now reads as an application portal, not a brochure.

<!-- Add new case studies above this line as we ship more redesigns. -->
