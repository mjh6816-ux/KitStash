DO $$
DECLARE
  my_user_id uuid := 'a8e4287a-040b-41dd-ba45-87f6a3c07395';   -- ← your real UUID (only change this if needed)
BEGIN

RAISE NOTICE 'Using user_id: %', my_user_id;

-- Aftermarket Parts
INSERT INTO aftermarket_parts (user_id, name, manufacturer_id, scale_id, part_type_id, quantity_owned, location, notes)
VALUES
(my_user_id, 'F-15E Cockpit Detail Set',
  (SELECT id FROM manufacturers WHERE name = 'Tamiya' LIMIT 1),
  (SELECT id FROM scales WHERE name = '1/48' LIMIT 1),
  (SELECT id FROM part_types WHERE name = 'Photoetch' LIMIT 1),
  2, 'Shelf A3 Bin 12', 'For Tamiya 1/48 F-15E'),

(my_user_id, 'P-51D Merlin Engine (Resin)',
  (SELECT id FROM manufacturers WHERE name = 'Zoukei-Mura' LIMIT 1),
  (SELECT id FROM scales WHERE name = '1/32' LIMIT 1),
  (SELECT id FROM part_types WHERE name = 'Resin' LIMIT 1),
  1, 'Shelf B2', 'High detail resin engine'),

(my_user_id, 'Spitfire Mk.IX Stencil Decals',
  (SELECT id FROM manufacturers WHERE name = 'Hasegawa' LIMIT 1),
  (SELECT id FROM scales WHERE name = '1/72' LIMIT 1),
  (SELECT id FROM part_types WHERE name = 'Decal' LIMIT 1),
  3, 'Decal folder', 'Generic stencil set'),

(my_user_id, 'Leopard 2A7 Photoetch Set',
  (SELECT id FROM manufacturers WHERE name = 'Meng' LIMIT 1),
  (SELECT id FROM scales WHERE name = '1/35' LIMIT 1),
  (SELECT id FROM part_types WHERE name = 'Photoetch' LIMIT 1),
  1, 'Shelf A3 Bin 14', NULL),

(my_user_id, '1/48 Metal Landing Gear Set',
  (SELECT id FROM manufacturers WHERE name = 'Fine Molds' LIMIT 1),
  (SELECT id FROM scales WHERE name = '1/48' LIMIT 1),
  (SELECT id FROM part_types WHERE name = 'Photoetch' LIMIT 1),
  1, 'Shelf C1', 'White metal gear legs');

-- Kits
INSERT INTO kits (user_id, name, manufacturer_id, scale_id, kit_type_id, status, location, notes)
VALUES
(my_user_id, 'F-15E Strike Eagle',
  (SELECT id FROM manufacturers WHERE name = 'Tamiya' LIMIT 1),
  (SELECT id FROM scales WHERE name = '1/48' LIMIT 1),
  (SELECT id FROM kit_types WHERE name = 'Air - Multi Engine Jet' LIMIT 1),
  'in_stash', 'Shelf A1', 'Box is in good shape'),

(my_user_id, 'Leopard 2A7',
  (SELECT id FROM manufacturers WHERE name = 'Meng' LIMIT 1),
  (SELECT id FROM scales WHERE name = '1/35' LIMIT 1),
  (SELECT id FROM kit_types WHERE name = 'Military - Armor' LIMIT 1),
  'in_stash', 'Shelf B4', NULL),

(my_user_id, 'Spitfire Mk IX',
  (SELECT id FROM manufacturers WHERE name = 'Airfix' LIMIT 1),
  (SELECT id FROM scales WHERE name = '1/72' LIMIT 1),
  (SELECT id FROM kit_types WHERE name = 'Air - Single Engine Prop' LIMIT 1),
  'in_progress', 'Workbench', 'Currently building'),

(my_user_id, 'F-14A Tomcat',
  (SELECT id FROM manufacturers WHERE name = 'Hasegawa' LIMIT 1),
  (SELECT id FROM scales WHERE name = '1/72' LIMIT 1),
  (SELECT id FROM kit_types WHERE name = 'Air - Multi Engine Jet' LIMIT 1),
  'in_stash', 'Shelf A2', 'Old but nice kit');

-- Paints
INSERT INTO paints (user_id, color_name, brand, paint_type_id, color_code, quantity_owned, location, opened, notes)
VALUES
(my_user_id, 'Flat Black', 'Tamiya',
  (SELECT id FROM paint_types WHERE name = 'Acrylic' LIMIT 1),
  'XF-1', 3, 'Paint rack - Row 1', true, 'Heavily used for weathering'),

(my_user_id, 'White', 'Vallejo',
  (SELECT id FROM paint_types WHERE name = 'Acrylic' LIMIT 1),
  '70.951', 2, 'Paint rack - Row 2', false, NULL),

(my_user_id, 'Flat White', 'Tamiya',
  (SELECT id FROM paint_types WHERE name = 'Acrylic' LIMIT 1),
  'XF-2', 1, 'Paint rack - Row 1', true, NULL),

(my_user_id, 'Silver', 'Gunze',
  (SELECT id FROM paint_types WHERE name = 'Lacquer' LIMIT 1),
  'C8', 2, 'Paint rack - Row 3', false, 'Metallic lacquer'),

(my_user_id, 'RAF Dark Green', 'Tamiya',
  (SELECT id FROM paint_types WHERE name = 'Acrylic' LIMIT 1),
  'XF-81', 1, 'Paint rack - Row 2', true, 'Good for WWII subjects'),

(my_user_id, 'Flat Black', 'Vallejo',
  (SELECT id FROM paint_types WHERE name = 'Acrylic' LIMIT 1),
  '70.950', 4, 'Paint rack - Row 1', false, 'Backup bottle');

RAISE NOTICE 'Seed data script finished successfully.';

END $$;