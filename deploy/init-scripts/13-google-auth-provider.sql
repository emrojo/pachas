-- ==============================================================================
-- MIGRATION 13: GOOGLE AUTH PROVIDER
-- ==============================================================================
-- Adds auth_provider column to auth.users to distinguish between
-- email/password accounts and Google OAuth accounts.
-- ==============================================================================

DO $$
BEGIN
    ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'email';
EXCEPTION WHEN others THEN
    NULL;
END
$$;
