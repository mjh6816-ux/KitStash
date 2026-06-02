// Run with: node cleanup-duplicates.js
// This uses the service_role key to safely remove duplicate sample data.

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const USER_ID = 'a8e4287a-040b-41dd-ba45-87f6a3c07395';

async function cleanupDuplicates() {
  console.log('Starting duplicate cleanup...');

  // Clean aftermarket_parts - keep oldest per name
  const { data: parts } = await supabase
    .from('aftermarket_parts')
    .select('id, name, created_at')
    .eq('user_id', USER_ID)
    .order('created_at', { ascending: true });

  if (parts) {
    const seen = new Set();
    const toDelete = parts
      .filter(p => {
        if (seen.has(p.name)) return true;
        seen.add(p.name);
        return false;
      })
      .map(p => p.id);

    if (toDelete.length > 0) {
      const { error } = await supabase
        .from('aftermarket_parts')
        .delete()
        .in('id', toDelete);
      if (error) console.error('Error cleaning parts:', error);
      else console.log(`✓ Removed ${toDelete.length} duplicate aftermarket parts`);
    } else {
      console.log('✓ No duplicate aftermarket parts found');
    }
  }

  // Clean kits - keep oldest per name
  const { data: kits } = await supabase
    .from('kits')
    .select('id, name, created_at')
    .eq('user_id', USER_ID)
    .order('created_at', { ascending: true });

  if (kits) {
    const seen = new Set();
    const toDelete = kits
      .filter(k => {
        if (seen.has(k.name)) return true;
        seen.add(k.name);
        return false;
      })
      .map(k => k.id);

    if (toDelete.length > 0) {
      const { error } = await supabase
        .from('kits')
        .delete()
        .in('id', toDelete);
      if (error) console.error('Error cleaning kits:', error);
      else console.log(`✓ Removed ${toDelete.length} duplicate kits`);
    } else {
      console.log('✓ No duplicate kits found');
    }
  }

  // Clean paints - keep oldest per color_name + brand
  const { data: paints } = await supabase
    .from('paints')
    .select('id, color_name, brand, created_at')
    .eq('user_id', USER_ID)
    .order('created_at', { ascending: true });

  if (paints) {
    const seen = new Set();
    const toDelete = paints
      .filter(p => {
        const key = `${p.color_name}|||${p.brand}`;
        if (seen.has(key)) return true;
        seen.add(key);
        return false;
      })
      .map(p => p.id);

    if (toDelete.length > 0) {
      const { error } = await supabase
        .from('paints')
        .delete()
        .in('id', toDelete);
      if (error) console.error('Error cleaning paints:', error);
      else console.log(`✓ Removed ${toDelete.length} duplicate paints`);
    } else {
      console.log('✓ No duplicate paints found');
    }
  }

  // Remove any test rows
  const { error: testError } = await supabase
    .from('aftermarket_parts')
    .delete()
    .eq('name', 'TEST - Direct Insert');

  if (!testError) {
    console.log('✓ Removed any test rows');
  }

  console.log('\n✅ Cleanup finished. Refresh your inventory page.');
}

cleanupDuplicates().catch(console.error);
