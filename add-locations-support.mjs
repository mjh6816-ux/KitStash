// add-locations-support.mjs
// Run with: node add-locations-support.mjs
//
// This script helps with the Locations lookup migration.
// It will:
// 1. Print the exact DDL you need to run (safest in Dashboard Table Editor).
// 2. Offer to backfill distinct locations from your existing data (using service role).

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

console.log(`
=================================================================
LOCATIONS TABLE MIGRATION
=================================================================

STEP 1: Create the schema (do this first)

Option A (Recommended - easiest):
  Go to Supabase Dashboard → Table Editor
  - Create new table called "locations"
    - id: uuid (primary, default uuid_generate_v4())
    - name: text (not null)
    - user_id: uuid (default your user id)
    - created_at: timestamptz (default now())

  Then add these columns to the three main tables:
    - aftermarket_parts: location_id (uuid, foreign key → locations.id)
    - kits:           location_id (uuid, foreign key → locations.id)
    - paints:         location_id (uuid, foreign key → locations.id)

Option B (SQL - paste in SQL Editor if you prefer):
`);

console.log(`
-- 1. Create locations table
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  user_id uuid NOT NULL DEFAULT 'a8e4287a-040b-41dd-ba45-87f6a3c07395',
  created_at timestamptz DEFAULT now()
);

-- 2. Add location_id columns
ALTER TABLE aftermarket_parts ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id);
ALTER TABLE kits           ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id);
ALTER TABLE paints         ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id);

-- 3. (Optional) Reload schema cache
NOTIFY pgrst, 'reload schema';
`);

console.log(`
After you have created the table + columns, come back and run this script again
with the --backfill flag to populate locations from your existing data.

Example:
  node add-locations-support.mjs --backfill

=================================================================
`);

async function backfillLocations() {
  console.log('\nStarting backfill of locations from existing data...\n');

  // Collect all distinct non-null location strings
  const { data: partsLocs } = await supabase
    .from('aftermarket_parts')
    .select('location')
    .not('location', 'is', null);

  const { data: kitsLocs } = await supabase
    .from('kits')
    .select('location')
    .not('location', 'is', null);

  const { data: paintsLocs } = await supabase
    .from('paints')
    .select('location')
    .not('location', 'is', null);

  const allLocations = new Set([
    ...(partsLocs || []).map(r => r.location),
    ...(kitsLocs || []).map(r => r.location),
    ...(paintsLocs || []).map(r => r.location),
  ].filter(Boolean));

  if (allLocations.size === 0) {
    console.log('No existing location strings found to backfill.');
    return;
  }

  console.log(`Found ${allLocations.size} distinct location values to create.`);

  const rows = Array.from(allLocations).map(name => ({
    name: name.trim(),
    user_id: 'a8e4287a-040b-41dd-ba45-87f6a3c07395'
  }));

  const { data, error } = await supabase
    .from('locations')
    .upsert(rows, { onConflict: 'name', ignoreDuplicates: true })
    .select('id, name');

  if (error) {
    console.error('Error creating locations:', error);
    return;
  }

  console.log(`✅ Created/updated ${data.length} location records.`);

  // Note: Full backfill of location_id on existing rows would require more logic
  // (matching old text to new IDs). We can add that later if you want.
  console.log('\nNext step (optional): We can write a follow-up script to link existing items to the new location records by name.');
  console.log('Let me know if you want that.');
}

if (process.argv.includes('--backfill')) {
  backfillLocations();
} else {
  console.log('Run with --backfill after creating the schema to populate the locations table from your existing data.');
}
