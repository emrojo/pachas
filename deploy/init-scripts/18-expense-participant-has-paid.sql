-- ==============================================================================
-- PACHAS MIGRATION 18: EXPENSE PARTICIPANT REIMBURSEMENT STATUS (has_paid)
-- ==============================================================================
-- Adds column has_paid BOOLEAN DEFAULT FALSE NOT NULL to public.expense_participants.
-- Allows tracking which participants have reimbursed / returned their share of an
-- expense directly to the payer(s).
-- ==============================================================================

ALTER TABLE public.expense_participants 
ADD COLUMN IF NOT EXISTS has_paid BOOLEAN DEFAULT FALSE NOT NULL;

CREATE INDEX IF NOT EXISTS idx_expense_participants_has_paid 
ON public.expense_participants(has_paid);
