-- Migration: Add Frozen / Moderation Investigation Status to Groups (FR-44)
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS frozen_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS frozen_reason TEXT;
