-- ==============================================================================
-- MIGRATION 15: EXPENSE ITEMS & ITEMIZED SPLIT
-- ==============================================================================
-- Supports individual line items / products scanned or entered for an expense,
-- recording description, price, and assigned participant user IDs.
-- Also permits split_type = 'ITEMIZED' in public.expenses.
-- ==============================================================================

DO $$
BEGIN
    -- 1. Create table for expense line items
    CREATE TABLE IF NOT EXISTS public.expense_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        price NUMERIC(12, 2) NOT NULL,
        assigned_user_ids TEXT[] DEFAULT '{}' NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );

    -- 2. Create index on expense_id for fast lookup
    CREATE INDEX IF NOT EXISTS idx_expense_items_expense_id ON public.expense_items(expense_id);

    -- 3. Adjust split_type CHECK constraint to include 'ITEMIZED'
    ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_split_type_check;
    ALTER TABLE public.expenses ADD CONSTRAINT expenses_split_type_check 
        CHECK (split_type IN ('EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES', 'ITEMIZED'));
EXCEPTION WHEN others THEN
    NULL;
END
$$;
