import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || '';

// Supabase transaction pooler supports prepared statements disabled (prepare: false)
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
