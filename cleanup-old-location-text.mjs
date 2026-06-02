// cleanup-old-location-text.mjs
// Run after the Locations migration is complete.
// This sets the old free-text `location` column to NULL for any rows
// that now have a proper location_id. This keeps the database clean.

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const USER_ID = 'a8e4287a-040b-41dd-ba45-87f6a3c07395';

async function cleanup(table) {
  console.log(`Cleaning ${table}...`);

  const { data, error } = await supabase
    .from(table)
    .update({ location: null })
    .eq('user_id', USER_ID)
    .not('location_id', 'is', null)
    .not('location', 'is', null);

  if (error) {
    console.error(`  Error on ${table}:`, error.message);
  } else {
    console.log(`  ✅ Cleared old location text on rows that now have location_id`);
  }
}

async function main() {
  console.log('=== Cleanup old free-text location values ===\n');

  await cleanup('aftermarket_parts');
  await cleanup('kits');
  await cleanup('paints');

  console.log('\nDone. The old text `location` column is now cleared where we have proper location_id.');
  console.log('You can leave the column in the database for now, or drop it later once everything feels stable.');
}

main().catch(console.error);