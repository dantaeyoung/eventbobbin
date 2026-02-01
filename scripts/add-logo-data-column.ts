import { config } from 'dotenv';
config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  console.log('Adding logo_data column to sources table...');

  try {
    await sql`ALTER TABLE sources ADD COLUMN IF NOT EXISTS logo_data TEXT`;
    console.log('Done! Column added successfully.');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
