// Run with: node seed.js
// This uses the service_role key so it bypasses RLS completely.

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

const USER_ID = 'a8e4287a-040b-41dd-ba45-87f6a3c07395'; // Your user UUID

async function getId(table, column, value) {
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .eq(column, value)
    .single();
  if (error) {
    console.error(`Error fetching ${table} ${value}:`, error);
    return null;
  }
  return data?.id;
}

async function seed() {
  console.log('Starting seed with service role key...');

  // Pre-fetch all needed IDs
  const manufacturerTamiya = await getId('manufacturers', 'name', 'Tamiya');
  const manufacturerZoukei = await getId('manufacturers', 'name', 'Zoukei-Mura');
  const manufacturerHasegawa = await getId('manufacturers', 'name', 'Hasegawa');
  const manufacturerMeng = await getId('manufacturers', 'name', 'Meng');
  const manufacturerFineMolds = await getId('manufacturers', 'name', 'Fine Molds');
  const manufacturerAirfix = await getId('manufacturers', 'name', 'Airfix');

  const scale48 = await getId('scales', 'name', '1/48');
  const scale32 = await getId('scales', 'name', '1/32');
  const scale72 = await getId('scales', 'name', '1/72');
  const scale35 = await getId('scales', 'name', '1/35');

  const partPhotoetch = await getId('part_types', 'name', 'Photoetch');
  const partResin = await getId('part_types', 'name', 'Resin');
  const partDecal = await getId('part_types', 'name', 'Decal');

  const kitAirMulti = await getId('kit_types', 'name', 'Air - Multi Engine Jet');
  const kitAirSingle = await getId('kit_types', 'name', 'Air - Single Engine Prop');
  const kitArmor = await getId('kit_types', 'name', 'Military - Armor');

  const paintAcrylic = await getId('paint_types', 'name', 'Acrylic');
  const paintLacquer = await getId('paint_types', 'name', 'Lacquer');

  // --- Aftermarket Parts ---
  const { error: partsError } = await supabase.from('aftermarket_parts').insert([
    {
      user_id: USER_ID,
      name: 'F-15E Cockpit Detail Set',
      manufacturer_id: manufacturerTamiya,
      scale_id: scale48,
      part_type_id: partPhotoetch,
      quantity_owned: 2,
      location: 'Shelf A3 Bin 12',
      notes: 'For Tamiya 1/48 F-15E',
    },
    {
      user_id: USER_ID,
      name: 'P-51D Merlin Engine (Resin)',
      manufacturer_id: manufacturerZoukei,
      scale_id: scale32,
      part_type_id: partResin,
      quantity_owned: 1,
      location: 'Shelf B2',
      notes: 'High detail resin engine',
    },
    {
      user_id: USER_ID,
      name: 'Spitfire Mk.IX Stencil Decals',
      manufacturer_id: manufacturerHasegawa,
      scale_id: scale72,
      part_type_id: partDecal,
      quantity_owned: 3,
      location: 'Decal folder',
      notes: 'Generic stencil set',
    },
    {
      user_id: USER_ID,
      name: 'Leopard 2A7 Photoetch Set',
      manufacturer_id: manufacturerMeng,
      scale_id: scale35,
      part_type_id: partPhotoetch,
      quantity_owned: 1,
      location: 'Shelf A3 Bin 14',
      notes: null,
    },
    {
      user_id: USER_ID,
      name: '1/48 Metal Landing Gear Set',
      manufacturer_id: manufacturerFineMolds,
      scale_id: scale48,
      part_type_id: partPhotoetch,
      quantity_owned: 1,
      location: 'Shelf C1',
      notes: 'White metal gear legs',
    },
  ]);

  if (partsError) {
    console.error('Error seeding aftermarket_parts:', partsError);
  } else {
    console.log('✓ Seeded aftermarket_parts');
  }

  // --- Kits ---
  const { error: kitsError } = await supabase.from('kits').insert([
    {
      user_id: USER_ID,
      name: 'F-15E Strike Eagle',
      manufacturer_id: manufacturerTamiya,
      scale_id: scale48,
      kit_type_id: kitAirMulti,
      status: 'in_stash',
      location: 'Shelf A1',
      notes: 'Box is in good shape',
    },
    {
      user_id: USER_ID,
      name: 'Leopard 2A7',
      manufacturer_id: manufacturerMeng,
      scale_id: scale35,
      kit_type_id: kitArmor,
      status: 'in_stash',
      location: 'Shelf B4',
      notes: null,
    },
    {
      user_id: USER_ID,
      name: 'Spitfire Mk IX',
      manufacturer_id: manufacturerAirfix,
      scale_id: scale72,
      kit_type_id: kitAirSingle,
      status: 'in_progress',
      location: 'Workbench',
      notes: 'Currently building',
    },
    {
      user_id: USER_ID,
      name: 'F-14A Tomcat',
      manufacturer_id: manufacturerHasegawa,
      scale_id: scale72,
      kit_type_id: kitAirMulti,
      status: 'in_stash',
      location: 'Shelf A2',
      notes: 'Old but nice kit',
    },
  ]);

  if (kitsError) {
    console.error('Error seeding kits:', kitsError);
  } else {
    console.log('✓ Seeded kits');
  }

  // --- Paints ---
  const { error: paintsError } = await supabase.from('paints').insert([
    {
      user_id: USER_ID,
      color_name: 'Flat Black',
      brand: 'Tamiya',
      paint_type_id: paintAcrylic,
      color_code: 'XF-1',
      quantity_owned: 3,
      location: 'Paint rack - Row 1',
      opened: true,
      notes: 'Heavily used for weathering',
    },
    {
      user_id: USER_ID,
      color_name: 'White',
      brand: 'Vallejo',
      paint_type_id: paintAcrylic,
      color_code: '70.951',
      quantity_owned: 2,
      location: 'Paint rack - Row 2',
      opened: false,
      notes: null,
    },
    {
      user_id: USER_ID,
      color_name: 'Flat White',
      brand: 'Tamiya',
      paint_type_id: paintAcrylic,
      color_code: 'XF-2',
      quantity_owned: 1,
      location: 'Paint rack - Row 1',
      opened: true,
      notes: null,
    },
    {
      user_id: USER_ID,
      color_name: 'Silver',
      brand: 'Gunze',
      paint_type_id: paintLacquer,
      color_code: 'C8',
      quantity_owned: 2,
      location: 'Paint rack - Row 3',
      opened: false,
      notes: 'Metallic lacquer',
    },
    {
      user_id: USER_ID,
      color_name: 'RAF Dark Green',
      brand: 'Tamiya',
      paint_type_id: paintAcrylic,
      color_code: 'XF-81',
      quantity_owned: 1,
      location: 'Paint rack - Row 2',
      opened: true,
      notes: 'Good for WWII subjects',
    },
    {
      user_id: USER_ID,
      color_name: 'Flat Black',
      brand: 'Vallejo',
      paint_type_id: paintAcrylic,
      color_code: '70.950',
      quantity_owned: 4,
      location: 'Paint rack - Row 1',
      opened: false,
      notes: 'Backup bottle',
    },
  ]);

  if (paintsError) {
    console.error('Error seeding paints:', paintsError);
  } else {
    console.log('✓ Seeded paints');
  }

  console.log('\n✅ Seed completed!');
}

seed().catch(console.error);
