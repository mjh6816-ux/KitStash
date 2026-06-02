// add-stock-columns.mjs
// Helper script - just prints the exact SQL you need to run.
// Run with: node add-stock-columns.mjs

console.log(`
=================================================================
STOCK COLUMNS MIGRATION - Run this in Supabase SQL Editor
=================================================================

-- Aftermarket Parts
ALTER TABLE aftermarket_parts 
  ADD COLUMN IF NOT EXISTS quantity_allocated integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_used integer NOT NULL DEFAULT 0;

-- Kits
ALTER TABLE kits 
  ADD COLUMN IF NOT EXISTS quantity_allocated integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_used integer NOT NULL DEFAULT 0;

-- Paints
ALTER TABLE paints 
  ADD COLUMN IF NOT EXISTS quantity_allocated integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_used integer NOT NULL DEFAULT 0;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

=================================================================
After running the above, come back and tell me it succeeded.
Then we'll update the app to use the new columns.
=================================================================
`);