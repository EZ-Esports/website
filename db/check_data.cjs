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
  
  try {
    const players = await sql`SELECT id, role FROM players`;
    console.log('\n--- Players Data ---');
    console.table(players);

    const roles = await sql`SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'player_role'`;
    console.log('\n--- player_role Enum Labels ---');
    console.table(roles);

  } catch (err) {
    console.error('Error querying data:', err.message);
  }

  await sql.end();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Connection failed:', err);
  process.exit(1);
});
