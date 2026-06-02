// add-purchase-and-value-fields.mjs
// Run with: node add-purchase-and-value-fields.mjs
//
// Adds current_value and value_last_updated to the three main tables.

console.log(`
=================================================================
RUN THIS SQL IN SUPABASE (recommended via Table Editor or SQL Editor)
=================================================================

-- Aftermarket Parts
ALTER TABLE aftermarket_parts 
  ADD COLUMN IF NOT EXISTS current_value numeric,
  ADD COLUMN IF NOT EXISTS value_last_updated date;

-- Kits
ALTER TABLE kits 
  ADD COLUMN IF NOT EXISTS current_value numeric,
  ADD COLUMN IF NOT EXISTS value_last_updated date;

-- Paints
ALTER TABLE paints 
  ADD COLUMN IF NOT EXISTS current_value numeric,
  ADD COLUMN IF NOT EXISTS value_last_updated date;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

=================================================================
After running the above, reply here and I'll wire up the UI fields.
=================================================================
`);