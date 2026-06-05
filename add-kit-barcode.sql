-- =====================================================
-- Add barcode field to kits
-- Allows reliable identification of the same kit even when box art changes.
-- Primary use: quick lookup / "do I already own this?" at shops or conventions.
-- =====================================================

ALTER TABLE kits
ADD COLUMN IF NOT EXISTS barcode text;

-- Helpful index for fast barcode lookups (the main new use case)
CREATE INDEX IF NOT EXISTS idx_kits_barcode ON kits(barcode);

COMMENT ON COLUMN kits.barcode IS 'Product barcode (UPC, EAN, Code 128, etc.). More stable identifier than name or box art for the same physical kit release.';

-- Optional: backfill guidance (uncomment and adapt if you have existing data)
-- UPDATE kits SET barcode = '...' WHERE id = '...';

NOTIFY pgrst, 'reload schema';