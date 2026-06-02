-- Add flag to exclude specialized/project-specific parts and paints from Out of Stock alerts in dashboard/reports.
-- Run this in Supabase SQL Editor.

ALTER TABLE aftermarket_parts 
  ADD COLUMN IF NOT EXISTS exclude_from_out_of_stock boolean NOT NULL DEFAULT false;

ALTER TABLE paints 
  ADD COLUMN IF NOT EXISTS exclude_from_out_of_stock boolean NOT NULL DEFAULT false;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

COMMENT ON COLUMN aftermarket_parts.exclude_from_out_of_stock IS 'If true, this item will not appear in Out of Stock reports/alerts (e.g. specialized one-time parts for a project)';
COMMENT ON COLUMN paints.exclude_from_out_of_stock IS 'If true, this item will not appear in Out of Stock reports/alerts (e.g. specialized one-time paints for a project)';
