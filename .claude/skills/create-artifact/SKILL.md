---
name: create-artifact
description: Build an HTML design-exploration artifact for a page or section of this site — mockups, layout directions, or "give me N iterations" style requests. Load before drafting any artifact meant to represent how a page on this site could look.
---

# Create artifact (on-brand)

Produces design-exploration artifacts that could plausibly ship on this
site, not generic mockups.

## Steps

1. Load the global `artifact-design` skill first for general Artifact
   mechanics (structure, theming, responsiveness).
2. Read `ui/references/style-tokens.md` and pull the actual surface,
   accent, and per-game colors from it — a mockup that invents its own
   palette isn't a usable direction, it's a distraction.
3. Pull real copy, stats, and data from the actual page or worktree being
   explored, rather than lorem ipsum or invented numbers — the point of the
   artifact is to evaluate a layout against real content.
4. When producing multiple iterations, make each one a genuinely different
   structural direction (different layout skeleton, different information
   hierarchy) rather than color/spacing variations on the same layout — the
   goal is to give a real choice, not three shades of one idea.
5. State explicitly, once a direction is picked, that implementation happens
   through this site's real primitives (`Section`, `Card`, `CutCTA`, and the
   rest of `app/components/ui/` — see the `ui` skill) rather than porting the
   mockup's bespoke CSS. The artifact is a reference for layout and
   hierarchy, not a source to copy-paste from.
