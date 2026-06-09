-- Migration: Add catalog_number and kit_material support for kits
-- Run this on your Supabase DB (e.g. via SQL editor or psql)

-- 1. Create the kit_materials lookup table (similar to kit_types)
CREATE TABLE IF NOT EXISTS public.kit_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Add unique constraint so ON CONFLICT works for seeding
ALTER TABLE public.kit_materials ADD CONSTRAINT kit_materials_name_key UNIQUE (name);

-- Enable RLS and policies (same pattern as other lookups in enable-rls-all-tables.sql)
ALTER TABLE public.kit_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read kit_materials" ON public.kit_materials;
CREATE POLICY "Public can read kit_materials" ON public.kit_materials FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage kit_materials" ON public.kit_materials;
CREATE POLICY "Users can manage kit_materials" ON public.kit_materials FOR ALL USING (true);

-- 2. Add columns to kits
ALTER TABLE public.kits 
  ADD COLUMN IF NOT EXISTS catalog_number text,
  ADD COLUMN IF NOT EXISTS kit_material_id uuid REFERENCES public.kit_materials(id);

-- Optional: Add some common materials (you can delete/edit via the app)
INSERT INTO public.kit_materials (name) VALUES 
  ('Injection Molded Plastic'),
  ('Resin'),
  ('Multimedia'),
  ('3D Printed'),
  ('Cast Metal'),
  ('Wood'),
  ('Paper/Card'),
  ('Vinyl'),
  ('Other')
ON CONFLICT (name) DO NOTHING;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- Note: Realtime / schema cache may need reload in Supabase dashboard if you get errors on new table.
-- After running, the app forms will have the new fields + quick-add for materials.
-- Existing data will continue to work (nullable columns).