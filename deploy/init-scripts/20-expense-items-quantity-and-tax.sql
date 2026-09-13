-- ==============================================================================
-- MIGRATION 20: EXPENSE ITEMS QUANTITY AND TAXES (IVA / VAT / SALES TAX)
-- ==============================================================================
-- Adds support for:
-- 1. Multiple quantities per line item (quantity, unit_price, assigned_shares jsonb)
-- 2. Line item specific tax information (tax_name, tax_rate, tax_amount)
-- 3. Overall expense tax summary (tax_name, tax_amount, tax_rate, subtotal, tax_included)
-- ==============================================================================

DO $$
BEGIN
    -- 1. Add tax columns to public.expenses
    ALTER TABLE public.expenses 
        ADD COLUMN IF NOT EXISTS tax_name TEXT DEFAULT 'IVA' NOT NULL;

    ALTER TABLE public.expenses 
        ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2) DEFAULT 0 NOT NULL;

    ALTER TABLE public.expenses 
        ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2) DEFAULT NULL;

    ALTER TABLE public.expenses 
        ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2) DEFAULT NULL;

    ALTER TABLE public.expenses 
        ADD COLUMN IF NOT EXISTS tax_included BOOLEAN DEFAULT TRUE NOT NULL;

    -- 2. Add quantity, shares and tax columns to public.expense_items
    ALTER TABLE public.expense_items 
        ADD COLUMN IF NOT EXISTS quantity NUMERIC(10, 2) DEFAULT 1 NOT NULL;

    ALTER TABLE public.expense_items 
        ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12, 2) DEFAULT NULL;

    ALTER TABLE public.expense_items 
        ADD COLUMN IF NOT EXISTS tax_name TEXT DEFAULT 'IVA' NOT NULL;

    ALTER TABLE public.expense_items 
        ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2) DEFAULT 0 NOT NULL;

    ALTER TABLE public.expense_items 
        ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2) DEFAULT 0 NOT NULL;

    ALTER TABLE public.expense_items 
        ADD COLUMN IF NOT EXISTS assigned_shares JSONB DEFAULT '{}'::jsonb NOT NULL;

EXCEPTION WHEN others THEN
    NULL;
END
$$;
