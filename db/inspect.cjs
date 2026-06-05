const postgres = require('postgres');
const fs = require('fs');
const path = require('path');

// Parse .env manually
const envPath = path.join(__dirname, '../.env');
let databaseUrl = 'postgresql://postgres.hcgdnhrgkrhithhakhea:1IkwOjCRLDfQe6XC@aws-1-us-east-1.pooler.supabase.com:5432/postgres';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/^DATABASE_URL=["']?([^"'\r\n]+)["']?/m);
  if (match) {
    databaseUrl = match[1];
  }
}

const sql = postgres(databaseUrl);

async function main() {
  console.log('Connecting to database...');
  
  // 1. Drop the view which might be causing introspection parsing issues
  console.log('Dropping roster_standings view...');
  try {
    await sql`DROP VIEW IF EXISTS roster_standings CASCADE;`;
    console.log('Successfully dropped view roster_standings.');
  } catch (err) {
    console.error('Error dropping view:', err.message);
  }

  // 2. Query check constraints
  console.log('Querying check constraints in database...');
  try {
    const constraints = await sql`
      SELECT 
        conname as constraint_name, 
        conrelid::regclass as table_name, 
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE contype = 'c';
    `;
    console.log('\n--- Check Constraints Found ---');
    console.table(constraints);
  } catch (err) {
    console.error('Error querying constraints:', err.message);
  }

  // 3. Query all views
  console.log('\nQuerying database views...');
  try {
    const views = await sql`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public';
    `;
    console.log('\n--- Views Found ---');
    console.table(views);
  } catch (err) {
    console.error('Error querying views:', err.message);
  }

  await sql.end();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Connection failed:', err);
  process.exit(1);
});
