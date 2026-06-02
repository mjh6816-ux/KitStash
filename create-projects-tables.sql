-- =====================================================
-- Projects + Allocations Tables
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT 'a8e4287a-040b-41dd-ba45-87f6a3c07395',
  name text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'planning',
  conceived_date date,
  start_date date,
  target_date date,
  completed_date date,
  progress_percent integer DEFAULT 0,
  total_cost numeric,
  hero_image_url text,
  kit_id uuid REFERENCES kits(id),
  scale_id uuid REFERENCES scales(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Create project_allocations table (polymorphic allocation of inventory items)
CREATE TABLE IF NOT EXISTS project_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT 'a8e4287a-040b-41dd-ba45-87f6a3c07395',
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_id uuid NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('kit', 'part', 'paint')),
  quantity integer NOT NULL DEFAULT 1,
  allocation_status text NOT NULL DEFAULT 'allocated' CHECK (allocation_status IN ('allocated', 'used')),
  allocated_at timestamptz DEFAULT now(),
  used_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_project_allocations_project_id ON project_allocations(project_id);
CREATE INDEX IF NOT EXISTS idx_project_allocations_item ON project_allocations(item_id, item_type);

-- 4. Enable RLS (optional but recommended)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_allocations ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (adjust as needed)
CREATE POLICY "Users can manage their own projects" ON projects
  FOR ALL USING (user_id = 'a8e4287a-040b-41dd-ba45-87f6a3c07395');

CREATE POLICY "Users can manage their own project allocations" ON project_allocations
  FOR ALL USING (user_id = 'a8e4287a-040b-41dd-ba45-87f6a3c07395');

-- 5. Refresh schema cache
NOTIFY pgrst, 'reload schema';

COMMENT ON TABLE projects IS 'Build projects that combine kits, parts, and paints';
COMMENT ON TABLE project_allocations IS 'Tracks which specific inventory items are allocated to projects';