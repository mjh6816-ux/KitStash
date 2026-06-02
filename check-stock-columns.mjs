// check-stock-columns.mjs
// Verifies whether the new stock columns exist on aftermarket_parts, kits, and paints.
// Run with: node check-stock-columns.mjs

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
  console.log('🔍 Checking for stock tracking columns...\n');

  const tables = ['aftermarket_parts', 'kits', 'paints'];
  const requiredCols = ['quantity_allocated', 'quantity_used'];

  for (const table of tables) {
    console.log(`📋 Table: ${table}`);

    // Try information_schema first
    const { data: cols, error } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', table);

    if (error || !cols) {
      console.log('   (Could not read information_schema — falling back to probe method)');

      // Probe method: try to select the columns
      const { error: selectErr } = await supabase
        .from(table)
        .select('id, quantity_owned, quantity_allocated, quantity_used')
        .limit(1);

      if (selectErr) {
        console.log(`   ❌ Columns may be missing — select error: ${selectErr.message}`);
      } else {
        console.log('   ✅ Both new columns appear selectable (or were already present)');
      }
      console.log('');
      continue;
    }

    const existing = cols.map(c => c.column_name);
    for (const col of requiredCols) {
      const exists = existing.includes(col);
      console.log(`   ${exists ? '✅' : '❌'} ${col}`);
    }
    console.log('');
  }

  console.log('=== CHECK COMPLETE ===');
  console.log('If any ❌ appear, we will add the columns using the Table Editor (graphical) method.');
}

check().catch(e => {
  console.error('Script error:', e);
});
