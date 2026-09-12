-- ==============================================================================
-- MIGRATION 16: CLOSED VS OPEN GROUPS & ACCESS CONTROLS
-- ==============================================================================
-- Adds is_closed column to public.groups (defaulting to TRUE for new groups)
-- allowing groups to be strictly closed (individual unique invites/claim tokens only,
-- no general invite code allowed) or open (general public code permitted).
-- ==============================================================================

DO $$
BEGIN
    ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT TRUE NOT NULL;
EXCEPTION WHEN others THEN
    NULL;
END
$$;

CREATE INDEX IF NOT EXISTS idx_groups_is_closed ON public.groups(is_closed);
