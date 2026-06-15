import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || '';

// Supabase transaction pooler supports prepared statements disabled (prepare: false).
// Cap the per-instance pool and drop idle connections quickly so serverless
// instances don't hold pooler slots open between requests.
const client = postgres(connectionString, {
  prepare: false,
  max: 10,
  idle_timeout: 20,
});

export const db = drizzle(client, { schema });
