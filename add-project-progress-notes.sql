-- =====================================================
-- Project Progress Log (date-stamped notes)
-- Run this in Supabase SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS project_progress_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT 'a8e4287a-040b-41dd-ba45-87f6a3c07395',
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_progress_notes_project_id ON project_progress_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_project_progress_notes_user_id ON project_progress_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_project_progress_notes_created_at ON project_progress_notes(created_at);

-- RLS
ALTER TABLE project_progress_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own progress notes" 
  ON project_progress_notes
  FOR ALL USING (user_id = 'a8e4287a-040b-41dd-ba45-87f6a3c07395');

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

COMMENT ON TABLE project_progress_notes IS 'Date-stamped progress notes for project builds';