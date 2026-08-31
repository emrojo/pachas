-- ==============================================================================
-- PACHAS MIGRATION 11: USER PREFERRED LANGUAGE
-- Adds preferred_language column to public.profiles for persistent i18n
-- ==============================================================================

ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'es';
