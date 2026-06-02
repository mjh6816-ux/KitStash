-- =====================================================
-- Project References (links, books, notes, etc.)
-- Run this in Supabase SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS project_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT 'a8e4287a-040b-41dd-ba45-87f6a3c07395',
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  reference_type text NOT NULL CHECK (reference_type IN ('link', 'book', 'note', 'photo')),
  
  title text,
  url text,                    -- for link or photo (external URL is fine)
  
  -- Book-specific fields
  author text,
  page_number text,
  isbn text,
  
  notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_references_project_id ON project_references(project_id);
CREATE INDEX IF NOT EXISTS idx_project_references_user_id ON project_references(user_id);
CREATE INDEX IF NOT EXISTS idx_project_references_type ON project_references(reference_type);

-- RLS
ALTER TABLE project_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own references" 
  ON project_references
  FOR ALL USING (user_id = 'a8e4287a-040b-41dd-ba45-87f6a3c07395');

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

COMMENT ON TABLE project_references IS 'References (links, books, notes, photos) associated with a project';