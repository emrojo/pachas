-- ==============================================================================
-- PACHAS - DATABASE MIGRATION: EXPENSE DATE TO TIMESTAMPTZ
-- ==============================================================================
-- Upgrades expense_date from DATE to TIMESTAMP WITH TIME ZONE
-- This guarantees exact capture of invoice timestamps (hours and minutes)
-- without timezone shift or UTC midnight skew.
-- ==============================================================================

DO $$
BEGIN
    -- Upgrade column type if it exists and is of type date
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'expenses'
          AND column_name = 'expense_date'
          AND data_type = 'date'
    ) THEN
        ALTER TABLE public.expenses
        ALTER COLUMN expense_date TYPE timestamp with time zone
        USING expense_date::timestamp with time zone;
    END IF;
END $$;
