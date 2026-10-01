# spec-009 — Staff application: Productions Crew label and "Referred by"

**Date:** 30 Sep 2026

- Productions Crew is now last in the division list; its longer label wraps within its column.
- The Productions Crew division is now labelled "Productions Crew: Observer, shoutcaster, and/or graphics producer" (`PRODUCTIONS_CREW_ROLE`). The label is the stored value; older rows keep the bare "Productions Crew" and display as-is.
- Optional **Referred by** field at the bottom of the Role & Resume step on `/apply/staff`: an applicant who was referred enters the name of the staff member who referred them ("Referred by", 50 characters, enforced client and server). They still complete the full application.
- Stored as optional `referredBy` inside the existing `details` JSON (v4, additive), so no migration. Shown in the admin detail modal as "Referred By" when present.
- A separate member-facing referral form (new table, API, admin list) was built and then removed the same day: the intent is applicant-side referral only.
