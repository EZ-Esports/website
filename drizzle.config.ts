import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './app/lib/db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
});
