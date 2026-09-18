-- ==============================================================================
-- MIGRATION 23: UNCLAIMED CROSS-GROUP SYNC & AUTO-HEALING
-- ==============================================================================
-- Ensures that provisional (unclaimed) members added across multiple groups
-- maintain their unclaimed status, have group-specific unique claim tokens,
-- and auto-heals legacy rows where an unclaimed user was added without a claim token.
-- ==============================================================================

DO $$
BEGIN
    -- 1. Ensure columns exist
    ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS is_unclaimed BOOLEAN DEFAULT FALSE NOT NULL;
    ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS provisional_name TEXT;
    ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS claim_token TEXT;
    ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS claimed_by UUID;
    ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_unclaimed BOOLEAN DEFAULT FALSE NOT NULL;

    -- 2. Auto-heal any existing group_members rows where the user profile is unclaimed
    -- but the member row in group_members has is_unclaimed = FALSE or claim_token IS NULL
    UPDATE public.group_members gm
    SET is_unclaimed = TRUE,
        provisional_name = COALESCE(gm.provisional_name, p.full_name, 'Amigo'),
        claim_token = COALESCE(gm.claim_token, gen_random_uuid()::text)
    FROM public.profiles p
    WHERE gm.user_id::text = p.id::text
      AND gm.claimed_at IS NULL
      AND (p.is_unclaimed = TRUE OR p.email ILIKE 'unclaimed-%')
      AND (gm.is_unclaimed = FALSE OR gm.claim_token IS NULL);

EXCEPTION WHEN others THEN
    NULL;
END
$$;

-- 3. Ensure indexes exist
CREATE UNIQUE INDEX IF NOT EXISTS idx_group_members_claim_token ON public.group_members(claim_token) WHERE claim_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_group_members_unclaimed ON public.group_members(group_id, is_unclaimed);
