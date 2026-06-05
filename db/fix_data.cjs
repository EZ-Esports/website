const postgres = require('postgres');
const fs = require('fs');
const path = require('path');

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
    const result = await sql`
      UPDATE players
      SET role = LOWER(role)
      WHERE role IN ('Captain', 'Player', 'Coach', 'Sub');
    `;
    console.log(`Updated ${result.count} rows in players table.`);

    // Check again
    const players = await sql`SELECT id, role FROM players`;
    console.log('\n--- Players Data After Update ---');
    console.table(players);

  } catch (err) {
    console.error('Error updating data:', err.message);
  }

  await sql.end();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Connection failed:', err);
  process.exit(1);
});