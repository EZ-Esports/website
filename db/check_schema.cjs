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
    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'players';
    `;
    console.log('\n--- Players Schema ---');
    console.table(columns);

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