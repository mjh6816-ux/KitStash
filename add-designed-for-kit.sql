-- Add optional "designed for kit" association on aftermarket parts and paints.
-- This lets you mark a part (e.g. a specific photoetch set) or paint color as intended for one particular kit/subject
-- without allocating it to a project or affecting stock quantities.
--
-- Run this in Supabase SQL Editor (same as add-exclude-out-of-stock.sql).

ALTER TABLE aftermarket_parts
  ADD COLUMN IF NOT EXISTS designed_for_kit_id uuid REFERENCES kits(id);

ALTER TABLE paints
  ADD COLUMN IF NOT EXISTS designed_for_kit_id uuid REFERENCES kits(id);

-- Refresh PostgREST schema cache so the new columns and relationships are immediately visible.
NOTIFY pgrst, 'reload schema';

COMMENT ON COLUMN aftermarket_parts.designed_for_kit_id IS 'Optional link to a specific kit this aftermarket part was purchased/designed for (e.g. a photoetch or resin set for one model). Pure metadata — does not allocate stock or affect quantities. Use project_allocations for actual build usage.';
COMMENT ON COLUMN paints.designed_for_kit_id IS 'Optional link to a specific kit this paint color was purchased for. Pure metadata — does not allocate stock or affect quantities.';