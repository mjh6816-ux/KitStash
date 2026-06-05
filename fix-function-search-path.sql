-- =====================================================
-- Fix: Function Search Path Mutable
-- For: public.update_updated_at_column
--
-- This resolves the Supabase Security Advisor warning:
-- "Function public.update_updated_at_column has a role mutable search_path"
--
-- Why: Without an explicit search_path, a malicious user could potentially
-- hijack the function by manipulating the search path.
--
-- Run this in the Supabase SQL Editor.
-- =====================================================

-- The standard and recommended fix for this lint:
ALTER FUNCTION public.update_updated_at_column() 
  SET search_path = '';

-- Optional but more secure version (recommended):
-- If the above is not enough, or you want to recreate the function cleanly,
-- you can run the block below instead.
--
-- This ensures:
-- - SECURITY DEFINER (runs with the privileges of the function owner)
-- - Explicit empty search_path (prevents injection)
-- - Only updates the updated_at column safely

/*
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;
*/

-- After running, go back to Security Advisor and click "Rerun" / refresh.
-- The "Function Search Path Mutable" issue for this function should disappear.

NOTIFY pgrst, 'reload schema';
