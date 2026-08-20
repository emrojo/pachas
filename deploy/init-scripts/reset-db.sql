-- ==============================================================================
-- PACHAS DATABASE RESET SCRIPT (CLEAN SLATE FOR PRODUCTION)
-- ==============================================================================

-- Truncate all application tables with cascade
TRUNCATE TABLE 
    public.settlements,
    public.expense_participants,
    public.expense_payers,
    public.expenses,
    public.group_members,
    public.groups,
    public.profiles
CASCADE;

-- Vacuum to reclaim storage
VACUUM FULL;
