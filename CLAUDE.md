# Working in this repo

## `.env` points at live production

`DATABASE_URL` here is the production Supabase Postgres, not a local or staging
copy. There is no separate environment. Treat any script that reads `.env` as
capable of touching production data — because it is.

`npm run db:seed` and `npm run db:seed:gold` both delete and re-insert rows.
They are gated by `assertSeedTargetAllowed()` (`db/seed-target.ts`), which
refuses to run against anything but a loopback host unless
`SEED_ALLOW_REMOTE=<exact-hostname>` is set. **Do not treat that gate as
permission.** It stops an accident; it does not substitute for asking the user
before running a seed or a migration against production. Confirm first, every
time, even though the code would technically allow it.

If you're testing seed/migration changes, do it against a local Postgres with
an explicit `DATABASE_URL` — never by relying on `.env`.

## The Vercel Data Cache survives redeploys

`unstable_cache` entries (tags: `games`, `schools`, `members`, `teams`,
`seasons`, `matches`, `rosters`, `players`, `news`, `leadership`, `sponsors`,
`page-content`, `gallery-images`, `recent-results`) are **infrastructure**, not
build output. Redeploying does **not** clear them.

This matters specifically after anything that changes row UUIDs (a
delete-and-reinsert seed, a migration that regenerates ids): cached queries
keep handing out ids that no longer exist, queries succeed and match nothing,
and pages render empty while the database itself is fine. The fix is an
explicit `revalidateTag(...)` call or a manual cache purge from the Vercel
dashboard — not a redeploy.

A cheap way to force one without new tooling: edit any row through the
relevant admin page and save with its existing values. Every admin action
calls `revalidateTag` on save.

## PII lives in `sharepoint/` and in pre-seed backups

`sharepoint/bronze_data/`, `silver_data/`, `gold_data/`, any `*.csv` under
`sharepoint/`, and `db/backups/` (full `pg_dump`s) all carry student PII —
names, emails, Discord handles, hometowns, graduation years. This is a public
repo. All of these must stay gitignored.

Before any broad `git add -A` or similar, check `git status` for anything
under `sharepoint/` or `db/backups/` that looks like it shouldn't be there —
`.gitignore` patterns anchored to the repo root (`/*.csv`) do **not** cover the
same filename one directory down (`sharepoint/*.csv`). That gap existed here
and left two files with 169 students' contact info sitting untracked but
committable for an unknown period.

## Before declaring source data unrecoverable, ask

If a file is missing from the repo, the pipeline, and this machine, that is
not the same as the file not existing. Ask the user directly whether a copy
might exist somewhere you can't search — another machine, an email, a Drive
folder — before stating that data is permanently lost. In this repo's history,
data declared unrecoverable after a local search turned out to be sitting on
the user's machine under a name the search should have caught, and the user
supplied it after being asked plainly.

## Don't trust comments as proof, especially before something destructive

A code comment asserting a safety property (e.g. "this column is null for
every row, so deleting the parent table is safe") is a claim, not a
verification. Before relying on that kind of comment to justify a destructive
action against production, check the live database directly. A stale comment
here was the proximate cause of a data-loss incident: it was quoted back to
the user as a guarantee and never checked against the real table.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
