import { db } from '../../app/lib/db';
import { leadership } from '../../app/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

async function main() {
  console.log('--- BEFORE UPDATE ---');
  const before = await db
    .select()
    .from(leadership)
    .where(eq(leadership.name, 'Edison Zhong'));
  console.log(JSON.stringify(before, null, 2));

  console.log('\n--- PERFORMING UPDATE ---');
  const result = await db
    .update(leadership)
    .set({ role: 'Advisor' })
    .where(
      and(
        eq(leadership.name, 'Edison Zhong'),
        inArray(leadership.year, ['2023', '2025'])
      )
    )
    .returning();
  console.log('Updated rows:', JSON.stringify(result, null, 2));

  console.log('\n--- AFTER UPDATE ---');
  const after = await db
    .select()
    .from(leadership)
    .where(eq(leadership.name, 'Edison Zhong'));
  console.log(JSON.stringify(after, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Update failed:', err);
    process.exit(1);
  });
