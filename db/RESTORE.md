# Restoring a local backup

`db/backups/` holds `pg_dump` output written by `requireFreshBackup()`
(`db/backup.ts`) before every `db:seed`, `db:seed:gold`, and `db:migrate` run.
These are local-only files, gitignored, kept on whatever machine ran the
command — there is no central copy and no encryption step, because nothing
here ever leaves the machine. See `CLAUDE.md` for why that directory carries
PII and must stay that way.

Since Backups are scoped (see `db/backup.ts`'s `dumpTables()`/`dumpSchema()`),
a given file may contain either the whole `public` schema (`'full'` scope) or
just the handful of tables the seed/migration that produced it could touch.
Check which you have before you restore — a scoped dump has no `CREATE TABLE`
for anything outside its own table list, by design.

## Procedure

1. Pick a file from `db/backups/` (or ask whoever ran the last seed/migrate
   where theirs is — these are local-only, not centralized).

2. Restore into a **local or scratch Postgres instance, never directly
   against production** — this matches the project's existing rule
   (`CLAUDE.md`: "If you're testing seed/migration changes, do it against a
   local Postgres... never by relying on `.env`").

   A scoped dump only contains the tables it targeted, so restoring it into an
   *empty* scratch database requires the target schema to already exist there
   (run migrations first) — `--table`-scoped `pg_dump` output has no
   `CREATE TABLE` for tables outside its scope.

   ```
   psql <scratch-db-url> -f db/backups/<file>.sql
   ```

3. **Verify row counts / spot-check a few tables against expectations.** This
   is the real verification step — see the note below on why a clean,
   error-free `psql` run is not what to look for.

4. Restoring into production (if this is ever the actual recovery path, not a
   drill) requires explicit user confirmation per this repo's standing rule on
   destructive/production actions — not something to automate or
   gate-bypass.

## Expect "already exists" errors on a scoped restore — that's normal

If the target database already has the schema applied (the flow step 2
recommends), restoring a **scoped** dump into it will throw several
`already exists` errors: for the table's own `CREATE TABLE`, its constraints,
and its RLS policies, all of which migrations already created there. A scoped
`pg_dump` always includes the full DDL for its own table(s), redundant with
what the target's migrations already ran.

These are expected and harmless with plain `psql -f` — it keeps going past
them (non-interactive default) — and the `COPY` of actual data still succeeds
regardless. **Do not** treat a `psql` run with errors in its output as a
failed restore; treat step 3's row-count check as the real verification.

## Restore drill

Do this once, for real, against a scratch database, before trusting that "we
have backups" is more than a documented procedure nobody has run.
