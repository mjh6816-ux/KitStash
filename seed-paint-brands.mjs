// seed-paint-brands.mjs
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const brands = [
  'Tamiya', 'Vallejo', 'Gunze Sangyo', 'Mr. Color', 'AK Interactive',
  'Ammo by Mig', 'Scale75', 'Citadel', 'Army Painter', 'Humbrol',
  'Revell', 'Testors', 'Alclad II', 'Lifecolor', 'Hataka',
  'Mission Models', 'Sovereign Hobbies', 'White Ensign Models',
  'Colourcoats', 'Xtracolor'
];

async function seedBrands() {
  console.log('Seeding paint brands (upsert mode)...');

  const rows = brands.map(name => ({ name }));

  const { error } = await supabase
    .from('paint_brands')
    .upsert(rows, {
      onConflict: 'name',
      ignoreDuplicates: true
    });

  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`✅ Done. ${rows.length} brands processed (duplicates ignored).`);
  }
}

seedBrands();