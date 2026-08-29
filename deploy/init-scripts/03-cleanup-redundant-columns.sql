-- ==============================================================================
-- PACHAS MIGRATION: CLEANUP REDUNDANT COLUMNS IN EXPENSES
-- ==============================================================================
-- Drops exchange_rate and converted_amount from public.expenses table,
-- delegating all currency conversion rates to the centralized
-- public.exchange_rates table.
-- ==============================================================================

alter table public.expenses drop column if exists exchange_rate;
alter table public.expenses drop column if exists converted_amount;
