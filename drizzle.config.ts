import { defineConfig } from 'drizzle-kit';
import { assertSeedTargetAllowed } from './db/seed-target';

// Gate push against remote targets: drizzle-kit push directly applies schema changes
// to the target database without migration files, risking data loss if pointed at production.
const isPush =
  process.argv.some((arg) => arg.includes('push')) ||
  process.env.npm_lifecycle_event === 'db:push';

if (isPush) {
  assertSeedTargetAllowed();
}

export default defineConfig({
  schema: './app/lib/db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
});

