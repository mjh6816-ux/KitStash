-- =====================================================
-- Project Needed Items (Stuff I Still Need)
-- Run this in Supabase SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS project_needed_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT 'a8e4287a-040b-41dd-ba45-87f6a3c07395',
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Can be linked to existing inventory or be a custom/free-text entry
  item_type text CHECK (item_type IN ('kit', 'part', 'paint', 'other')) NOT NULL DEFAULT 'other',
  item_id uuid, -- optional: link to actual kit/part/paint if it exists in inventory
  
  name text NOT NULL,                    -- display name (required)
  quantity_needed integer NOT NULL DEFAULT 1,
  notes text,
  
  -- Future: could add priority, estimated cost, purchase source, etc.
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_needed_items_project_id ON project_needed_items(project_id);
CREATE INDEX IF NOT EXISTS idx_project_needed_items_user_id ON project_needed_items(user_id);

-- RLS (following the same pattern as other project tables)
ALTER TABLE project_needed_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own needed items" 
  ON project_needed_items
  FOR ALL USING (user_id = 'a8e4287a-040b-41dd-ba45-87f6a3c07395');

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

COMMENT ON TABLE project_needed_items IS 'Items a user still needs to acquire for a specific project build';