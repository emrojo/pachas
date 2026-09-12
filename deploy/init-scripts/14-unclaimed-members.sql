-- ==============================================================================
-- MIGRATION 14: UNCLAIMED MEMBERS & CLAIM TOKENS
-- ==============================================================================
-- Supports provisional/unclaimed group members that can be renamed,
-- invited via unique single-use claim tokens, claimed by real users,
-- and renounced back to free provisional slots.
-- ==============================================================================

DO $$
BEGIN
    -- 1. Add unclaimed member columns to public.group_members
    ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS is_unclaimed BOOLEAN DEFAULT FALSE NOT NULL;
    ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS provisional_name TEXT;
    ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS claim_token TEXT;
    ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP WITH TIME ZONE;

    -- 2. Add is_unclaimed flag to public.profiles
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_unclaimed BOOLEAN DEFAULT FALSE NOT NULL;
EXCEPTION WHEN others THEN
    NULL;
END
$$;

-- 3. Unique index on claim_token when present
CREATE UNIQUE INDEX IF NOT EXISTS idx_group_members_claim_token ON public.group_members(claim_token) WHERE claim_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_group_members_unclaimed ON public.group_members(group_id, is_unclaimed);
