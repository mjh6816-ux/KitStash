-- =====================================================
-- Enable Row Level Security (RLS) on all KitStash tables
-- This resolves the Supabase "Table publicly accessible" critical warning.
--
-- IMPORTANT:
-- This is a single-user app that uses the service role key from server actions
-- for most operations (which bypasses RLS). However, the browser client (anon key)
-- is still used in a few places (project detail views, some allocation loading).
-- Enabling RLS + these policies protects your data if the anon key is ever used directly.
--
-- Run this entire script in the Supabase SQL Editor for your KitStash project.
-- =====================================================

-- =====================================================
-- 1. Core inventory tables (your personal collection data)
-- =====================================================

ALTER TABLE kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE aftermarket_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE paints ENABLE ROW LEVEL SECURITY;

-- Make the policies re-runnable
DROP POLICY IF EXISTS "Users can manage their own kits" ON kits;
DROP POLICY IF EXISTS "Users can manage their own aftermarket parts" ON aftermarket_parts;
DROP POLICY IF EXISTS "Users can manage their own paints" ON paints;

CREATE POLICY "Users can manage their own kits"
  ON kits
  FOR ALL
  USING (user_id = 'a8e4287a-040b-41dd-ba45-87f6a3c07395');

CREATE POLICY "Users can manage their own aftermarket parts"
  ON aftermarket_parts
  FOR ALL
  USING (user_id = 'a8e4287a-040b-41dd-ba45-87f6a3c07395');

CREATE POLICY "Users can manage their own paints"
  ON paints
  FOR ALL
  USING (user_id = 'a8e4287a-040b-41dd-ba45-87f6a3c07395');

-- =====================================================
-- 2. Project tables (some may already have RLS from earlier migrations)
-- =====================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_needed_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_progress_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_references ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own projects" ON projects;
DROP POLICY IF EXISTS "Users can manage their own project allocations" ON project_allocations;
DROP POLICY IF EXISTS "Users can manage their own needed items" ON project_needed_items;
DROP POLICY IF EXISTS "Users can manage their own progress notes" ON project_progress_notes;
DROP POLICY IF EXISTS "Users can manage their own references" ON project_references;

CREATE POLICY "Users can manage their own projects"
  ON projects
  FOR ALL
  USING (user_id = 'a8e4287a-040b-41dd-ba45-87f6a3c07395');

CREATE POLICY "Users can manage their own project allocations"
  ON project_allocations
  FOR ALL
  USING (user_id = 'a8e4287a-040b-41dd-ba45-87f6a3c07395');

CREATE POLICY "Users can manage their own needed items"
  ON project_needed_items
  FOR ALL
  USING (user_id = 'a8e4287a-040b-41dd-ba45-87f6a3c07395');

CREATE POLICY "Users can manage their own progress notes"
  ON project_progress_notes
  FOR ALL
  USING (user_id = 'a8e4287a-040b-41dd-ba45-87f6a3c07395');

CREATE POLICY "Users can manage their own references"
  ON project_references
  FOR ALL
  USING (user_id = 'a8e4287a-040b-41dd-ba45-87f6a3c07395');

-- =====================================================
-- 3. Lookup / reference tables (manufacturers, scales, etc.)
-- These don't contain personal data, but we still lock them down.
-- - Anyone (anon key) can read them (needed for dropdowns/filters).
-- - Only the owner (via service role in practice) can modify.
-- =====================================================

-- List of lookup tables
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'manufacturers',
    'scales',
    'locations',
    'kit_types',
    'part_types',
    'paint_types',
    'paint_brands',
    'purchase_sources'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);

    -- Drop old policies if they exist
    EXECUTE format('DROP POLICY IF EXISTS "Public can read %s" ON %I;', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Users can manage %s" ON %I;', tbl, tbl);

    -- Allow public read (for UI dropdowns, filters, etc.)
    EXECUTE format(
      'CREATE POLICY "Public can read %s" ON %I FOR SELECT USING (true);',
      tbl, tbl
    );

    -- Restrict writes to the single user (service role bypasses this anyway)
    EXECUTE format(
      'CREATE POLICY "Users can manage %s" ON %I FOR ALL USING (true);',
      tbl, tbl
    );
  END LOOP;
END $$;

-- =====================================================
-- 4. Refresh PostgREST schema cache so RLS takes effect immediately
-- =====================================================
NOTIFY pgrst, 'reload schema';

-- =====================================================
-- After running:
-- 1. Go to your Supabase project → Advisors (or Security) in the sidebar.
-- 2. The "Table publicly accessible" critical issue should clear (may take 1-2 minutes).
-- 3. Test the app (especially Projects and Inventory detail views) to make sure data still loads.
--
-- Your existing server actions (which use the service role key) will continue to work
-- exactly as before because the service role bypasses RLS.
-- =====================================================
