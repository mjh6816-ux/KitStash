// migrate-locations-v2.mjs
// Improved migration script for populating location_id
// Run with: node migrate-locations-v2.mjs

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const USER_ID = 'a8e4287a-040b-41dd-ba45-87f6a3c07395';

async function main() {
  console.log('=== Improved Locations Migration (v2) ===\n');

  // 1. Get all existing locations
  const { data: allLocations, error: locErr } = await supabase
    .from('locations')
    .select('id, name')
    .eq('user_id', USER_ID);

  if (locErr) {
    console.error('Error fetching locations:', locErr);
    return;
  }

  console.log(`Found ${allLocations.length} locations in the lookup table.`);

  // Create case-insensitive map
  const nameToId = new Map();
  allLocations.forEach(loc => {
    nameToId.set(loc.name.toLowerCase().trim(), loc.id);
  });

  const tables = ['aftermarket_parts', 'kits', 'paints'];

  let grandTotalUpdated = 0;

  for (const table of tables) {
    console.log(`\n--- Processing ${table} ---`);

    // Get all rows that still have old text location but no location_id (or force all)
    const { data: rows, error } = await supabase
      .from(table)
      .select('id, location, location_id')
      .not('location', 'is', null)
      .eq('user_id', USER_ID);

    if (error) {
      console.error(`  Error fetching from ${table}:`, error.message);
      continue;
    }

    console.log(`  Found ${rows.length} rows with old location text.`);

    let updated = 0;
    let noMatch = 0;
    let alreadySet = 0;

    for (const row of rows) {
      if (row.location_id) {
        alreadySet++;
        continue;
      }

      const key = row.location.toLowerCase().trim();
      const locId = nameToId.get(key);

      if (!locId) {
        noMatch++;
        console.log(`  No match for: "${row.location}"`);
        continue;
      }

      const { error: updateErr } = await supabase
        .from(table)
        .update({ location_id: locId })
        .eq('id', row.id);

      if (updateErr) {
        console.error(`  Failed to update row ${row.id}:`, updateErr.message);
      } else {
        updated++;
      }
    }

    console.log(`  Updated: ${updated}`);
    console.log(`  Already had location_id: ${alreadySet}`);
    console.log(`  No matching location found: ${noMatch}`);

    grandTotalUpdated += updated;
  }

  console.log(`\n=== Total rows updated across all tables: ${grandTotalUpdated} ===`);

  // Optional: Show summary counts
  console.log('\n--- Current Status ---');
  for (const table of tables) {
    const { count: total } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', USER_ID);

    const { count: withId } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', USER_ID)
      .not('location_id', 'is', null);

    console.log(`${table}: ${withId}/${total} have location_id`);
  }
}

main().catch(console.error);