-- ==============================================================================
-- MIGRATION 21: EXPENSE ITEMS TAX INCLUDED STATUS
-- ==============================================================================
-- Adds support for:
-- 1. Explicit tax_included boolean per line item in public.expense_items
--    (identifying whether line price already includes VAT/tax or is net base)
-- ==============================================================================

DO $$
BEGIN
    ALTER TABLE public.expense_items 
        ADD COLUMN IF NOT EXISTS tax_included BOOLEAN DEFAULT TRUE NOT NULL;
EXCEPTION WHEN others THEN
    NULL;
END
$$;
