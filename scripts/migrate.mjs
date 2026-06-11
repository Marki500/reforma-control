import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsDir = resolve(__dirname, '..', 'supabase', 'migrations')

async function run() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    console.error('❌ Set DATABASE_URL env var, e.g.:')
    console.error('   $env:DATABASE_URL="postgresql://postgres:password@host:5432/postgres"')
    console.error('   Or paste the SQL in Supabase Studio > SQL Editor')
    process.exit(1)
  }

  const client = new pg.Client({ connectionString: dbUrl })
  await client.connect()

  const files = [
    '00004_inspirations.sql',
    '00005_storage_buckets.sql',
    '00006_technical_specs.sql',
    '00007_floor_plans.sql',
    '00008_notes.sql',
    '00009_quantity.sql',
    '00010_count_in_total.sql',
  ]

  for (const file of files) {
    const sql = readFileSync(resolve(migrationsDir, file), 'utf8')
    console.log(`Running ${file}...`)
    await client.query(sql)
    console.log(`  ✅ ${file} done`)
  }

  await client.end()
  console.log('\nAll migrations completed.')
}

run().catch((err) => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
