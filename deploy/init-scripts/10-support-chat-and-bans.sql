-- ==============================================================================
-- PACHAS MIGRATION: SUPPORT CHAT & USER BAN PROTOCOL (FR-46 & FR-47)
-- ==============================================================================

-- 1. Banned User Columns on public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ban_reason TEXT;

-- 2. Support Messages Table for User-Admin Direct Communication
CREATE TABLE IF NOT EXISTS public.support_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'admin')),
    message TEXT NOT NULL,
    category TEXT DEFAULT 'general' CHECK (category IN ('general', 'bug', 'report_clarification', 'appeal', 'other')),
    attachment_url TEXT,
    is_read_by_user BOOLEAN DEFAULT FALSE NOT NULL,
    is_read_by_admin BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_support_messages_user ON public.support_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_sender ON public.support_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_created ON public.support_messages(created_at ASC);

GRANT ALL ON TABLE public.support_messages TO public, anon, authenticated, service_role;
