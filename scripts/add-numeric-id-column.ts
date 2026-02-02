import { config } from 'dotenv';
config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  console.log('Adding numeric_id column to sources table...');

  try {
    // Add the column as a serial (auto-incrementing)
    await sql`ALTER TABLE sources ADD COLUMN IF NOT EXISTS numeric_id SERIAL`;

    // Add unique constraint
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'sources_numeric_id_unique'
        ) THEN
          ALTER TABLE sources ADD CONSTRAINT sources_numeric_id_unique UNIQUE (numeric_id);
        END IF;
      END $$
    `;

    console.log('Done! Column added successfully.');

    // Show current state
    const sources = await sql`SELECT id, name, numeric_id FROM sources ORDER BY numeric_id`;
    console.log('Current sources with numeric_id:');
    for (const source of sources) {
      console.log(`  ${source.numeric_id}: ${source.name}`);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
