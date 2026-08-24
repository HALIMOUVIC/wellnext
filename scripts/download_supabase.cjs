const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const url = process.env.SUPABASE_URL || 'https://fpbkonjlsfghewrcoswy.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';

console.log('Connecting to internet Supabase database at:', url);
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function downloadAll() {
  const tables = [
    'employees',
    'wells',
    'casing_strings',
    'tubing_components',
    'perforation_zones',
    'custom_tool_types',
    'well_history',
    'cement_plugs'
  ];

  const fullData = {};
  console.log('\n--- FETCHING ALL SUPABASE TABLES FROM INTERNET ---');

  for (const table of tables) {
    try {
      const { data, error, count } = await sb.from(table).select('*', { count: 'exact' });
      if (error) {
        console.error(`❌ Error fetching ${table}:`, error.message);
        fullData[table] = [];
      } else {
        fullData[table] = data || [];
        console.log(`✅ Table "${table}": downloaded ${data ? data.length : 0} rows.`);
      }
    } catch (err) {
      console.error(`❌ Exception downloading ${table}:`, err.message);
      fullData[table] = [];
    }
  }

  // Save JSON dump
  const dumpPath = path.join(__dirname, '..', 'supabase_full_dump.json');
  fs.writeFileSync(dumpPath, JSON.stringify(fullData, null, 2), 'utf-8');
  console.log(`\n💾 Saved complete JSON dump to: ${dumpPath}`);

  // Summary statistics
  console.log('\n--- SUPABASE DOWNLOAD SUMMARY ---');
  let totalRows = 0;
  for (const [table, rows] of Object.entries(fullData)) {
    console.log(`- ${table}: ${rows.length} records`);
    totalRows += rows.length;
  }
  console.log(`TOTAL RECORDS DOWNLOADED: ${totalRows}`);
}

downloadAll().catch(err => {
  console.error('Fatal error downloading Supabase data:', err);
});
