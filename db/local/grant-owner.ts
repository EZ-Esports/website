/**
 * Makes a signed-in person an Owner in the LOCAL database only, so the staff portal opens fully.
 *
 * The app creates a `staff_members` row for whoever signs in (it is how production works too), so the order is:
 * start the local database, run `npm run dev:local`, sign in once at /admin (you will see a permission notice),
 * then run this with the same email and refresh. It never contacts Supabase and never touches `.env`.
 *
 *   npm run db:local:grant-owner -- you@example.com
 */
import postgres from 'postgres';
import { requireLocalUrl } from './target';

const ADMINISTRATOR = 1n << 0n;

async function main(): Promise<void> {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error('Usage: npm run db:local:grant-owner -- <email>');
  const sql = postgres(requireLocalUrl(), { prepare: false, max: 1, onnotice: () => {} });
  try {
    const [staff] = await sql<{ user_id: string }[]>`select user_id from staff_members where lower(email) = ${email} limit 1`;
    if (!staff) {
      throw new Error(`No staff row for ${email} in the local database yet. Sign in at /admin once with that email, then run this again.`);
    }
    const [existing] = await sql<{ id: string }[]>`select id from roles where name = 'Owner' limit 1`;
    const ownerId =
      existing?.id ??
      (
        await sql<{ id: string }[]>`
          insert into roles (name, color, permissions, position, is_owner, is_system)
          values ('Owner', '#ef4444', ${ADMINISTRATOR.toString()}, 9999, true, true) returning id`
      )[0].id;
    await sql`insert into user_roles (user_id, role_id) values (${staff.user_id}, ${ownerId}) on conflict do nothing`;
    console.log(`${email} is an Owner in the local database. Refresh /admin.`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
