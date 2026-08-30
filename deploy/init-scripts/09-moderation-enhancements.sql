-- Migration: Moderation Enhancements, Resolution Notes, Evidence Snapshot & Dual Freeze Mode (FR-45)
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS freeze_type TEXT DEFAULT 'full';
ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS evidence_snapshot JSONB;
