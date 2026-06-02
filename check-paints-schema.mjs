// check-paints-schema.mjs
// Run with: node check-paints-schema.mjs
// Uses service role key (bypasses RLS) to inspect the actual paints table columns in Supabase.

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

async function check() {
  console.log('🔍 Checking paints table schema via service role...\n');

  // 1. Read column list from information_schema (service role can do this)
  const { data: cols, error: colErr } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable')
    .eq('table_schema', 'public')
    .eq('table_name', 'paints')
    .order('ordinal_position');

  if (colErr) {
    console.error('❌ Could not read information_schema (may be restricted):', colErr.message);
    console.log('Falling back to probe insert method...\n');
  } else {
    console.log('📋 Current columns in public.paints:');
    (cols || []).forEach(c => {
      console.log(`   - ${c.column_name} (${c.data_type})${c.is_nullable === 'YES' ? ' NULL' : ' NOT NULL'}`);
    });
    console.log('');
  }

  const targetCols = ['series', 'fs_number', 'ral_number', 'rlm_number', 'ana_number', 'paint_brand_id'];
  console.log('🎯 Checking for the new reference columns we added in code:');
  for (const col of targetCols) {
    const exists = (cols || []).some(c => c.column_name === col);
    console.log(`   ${exists ? '✅' : '❌'} ${col}`);
  }
  console.log('');

  // 2. Also check paint_brands table exists and has rows
  const { count: brandCount, error: brandErr } = await supabase
    .from('paint_brands')
    .select('*', { count: 'exact', head: true });

  if (brandErr) {
    console.log('❌ paint_brands table error:', brandErr.message);
  } else {
    console.log(`✅ paint_brands table exists with ${brandCount} rows (dropdown source)\n`);
  }

  // 3. Try a minimal safe insert (only columns that existed in the original schema)
  console.log('🧪 Testing minimal insert (core columns only: color_name + quantity + opened)...');
  const testColor = 'DIAGNOSTIC TEST ' + new Date().toISOString().slice(0,19);

  const { data: inserted, error: insErr } = await supabase
    .from('paints')
    .insert({
      user_id: 'a8e4287a-040b-41dd-ba45-87f6a3c07395',
      color_name: testColor,
      quantity_owned: 1,
      opened: false,
      // deliberately NOT including series/fs/ral etc or paint_brand_id here
    })
    .select('id, color_name')
    .single();

  if (insErr) {
    console.error('❌ MINIMAL INSERT FAILED:', insErr);
    console.log('\nThis means even basic inserts are blocked (RLS? wrong user_id? table missing?).');
    return;
  }

  console.log('✅ Minimal insert succeeded! Row id:', inserted.id);

  // Clean up the test row immediately
  await supabase.from('paints').delete().eq('id', inserted.id);
  console.log('🧹 Test row cleaned up.\n');

  // 4. If we got here, try inserting with ONE of the new columns to see the exact error
  console.log('🧪 Now testing insert that includes "series" column (the first new one)...');
  const { error: seriesErr } = await supabase
    .from('paints')
    .insert({
      user_id: 'a8e4287a-040b-41dd-ba45-87f6a3c07395',
      color_name: testColor + ' (with series)',
      quantity_owned: 1,
      opened: false,
      series: 'TEST-SERIES-123',
    });

  if (seriesErr) {
    console.error('❌ INSERT WITH "series" COLUMN FAILED:', seriesErr.message || seriesErr);
    console.log('\n👉 This is almost certainly your problem: the "series" (and probably the other 4 reference columns) do not exist in the paints table yet.');
    console.log('   You need to run the ALTER TABLE statements in the Supabase SQL Editor.');
  } else {
    console.log('✅ Insert with "series" also succeeded!');
    // cleanup
    await supabase.from('paints').delete().ilike('color_name', testColor + '%');
  }

  console.log('\n=== DIAGNOSIS COMPLETE ===');
  console.log('Next steps:');
  console.log('1. If any of the 6 target columns showed ❌ above, run the ALTERs in Supabase SQL Editor (see instructions in chat).');
  console.log('2. Re-run this script after the ALTERs:  node check-paints-schema.mjs');
  console.log('3. Then try adding a real paint from the UI again.');
}

check().catch(e => {
  console.error('Script crashed:', e);
  process.exit(1);
});
