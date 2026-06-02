// migrate-to-locations-lookup.mjs
// Run with: node migrate-to-locations-lookup.mjs
//
// This script helps complete the migration to a proper locations lookup table.
//
// What it does:
// 1. Prints the exact ALTER statements you need to run (once) to add location_id columns.
// 2. Backfills the locations table from your existing free-text location values.
// 3. Attempts to link existing items to the new location records via location_id.

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const USER_ID = 'a8e4287a-040b-41dd-ba45-87f6a3c07395';

async function main() {
  console.log('=== Locations Lookup Migration Helper ===\n');

  // === STEP 1: Print the required schema changes ===
  console.log(`
STEP 1 — Run these in Supabase (Dashboard Table Editor is safest):

-- Add location_id columns (if they don't exist yet)
ALTER TABLE aftermarket_parts 
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id);

ALTER TABLE kits 
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id);

ALTER TABLE paints 
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
`);

  console.log('After running the ALTERs above, press Enter to continue with backfill...');
  
  // Simple pause for user
  await new Promise(resolve => {
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.pause();
      resolve();
    });
  });

  console.log('\nStarting backfill...\n');

  // === STEP 2: Collect all existing location strings ===
  const { data: partsData } = await supabase
    .from('aftermarket_parts')
    .select('location')
    .not('location', 'is', null);

  const { data: kitsData } = await supabase
    .from('kits')
    .select('location')
    .not('location', 'is', null);

  const { data: paintsData } = await supabase
    .from('paints')
    .select('location')
    .not('location', 'is', null);

  const allTextLocations = new Set([
    ...(partsData || []).map(r => r.location?.trim()).filter(Boolean),
    ...(kitsData || []).map(r => r.location?.trim()).filter(Boolean),
    ...(paintsData || []).map(r => r.location?.trim()).filter(Boolean),
  ]);

  console.log(`Found ${allTextLocations.size} distinct non-null location strings in your data.`);

  if (allTextLocations.size === 0) {
    console.log('Nothing to backfill. Exiting.');
    return;
  }

  // === STEP 3: Insert missing locations ===
  const locationRows = Array.from(allTextLocations).map(name => ({
    name,
    user_id: USER_ID
  }));

  const { data: insertedLocations, error: insertErr } = await supabase
    .from('locations')
    .upsert(locationRows, {
      onConflict: 'name',
      ignoreDuplicates: true
    })
    .select('id, name');

  if (insertErr) {
    console.error('Error upserting locations:', insertErr);
    return;
  }

  console.log(`✅ Upserted ${insertedLocations.length} locations into the locations table.`);

  // Build a map of name -> id for linking
  const { data: allLocations } = await supabase
    .from('locations')
    .select('id, name')
    .eq('user_id', USER_ID);

  const locationNameToId = new Map();
  allLocations?.forEach(loc => {
    locationNameToId.set(loc.name, loc.id);
  });

  console.log(`Loaded ${locationNameToId.size} total locations for linking.`);

  // === STEP 4: Link existing items (best effort) ===
  let updatedCount = 0;

  // Parts
  for (const item of (partsData || [])) {
    if (!item.location) continue;
    const locId = locationNameToId.get(item.location.trim());
    if (!locId) continue;

    const { error } = await supabase
      .from('aftermarket_parts')
      .update({ location_id: locId })
      .eq('location', item.location)   // only update rows that still have the old text
      .is('location_id', null);        // safety: don't overwrite if already set

    if (!error) updatedCount++;
  }

  // Kits
  for (const item of (kitsData || [])) {
    if (!item.location) continue;
    const locId = locationNameToId.get(item.location.trim());
    if (!locId) continue;

    const { error } = await supabase
      .from('kits')
      .update({ location_id: locId })
      .eq('location', item.location)
      .is('location_id', null);

    if (!error) updatedCount++;
  }

  // Paints
  for (const item of (paintsData || [])) {
    if (!item.location) continue;
    const locId = locationNameToId.get(item.location.trim());
    if (!locId) continue;

    const { error } = await supabase
      .from('paints')
      .update({ location_id: locId })
      .eq('location', item.location)
      .is('location_id', null);

    if (!error) updatedCount++;
  }

  console.log(`\n✅ Attempted to link ${updatedCount} items to the new locations.`);

  console.log(`
=================================================================
NEXT STEPS
=================================================================

1. Run the ALTER statements printed above in the Supabase Dashboard (Table Editor or SQL Editor).

2. After the ALTERs succeed, run this script again:
     node migrate-to-locations-lookup.mjs

3. Once the schema and backfill are done, we can clean up the old free-text "location" column usage in the app if you want.

Let me know the output or any errors you see!
`);
}

main().catch(console.error);