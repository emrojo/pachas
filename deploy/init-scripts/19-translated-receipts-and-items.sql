-- Migration 19: Support translated receipts and bilingual line items
-- Adds receipt_translated_url to public.expenses
-- Adds description_original to public.expense_items

ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS receipt_translated_url TEXT;

ALTER TABLE public.expense_items 
ADD COLUMN IF NOT EXISTS description_original VARCHAR(255);
