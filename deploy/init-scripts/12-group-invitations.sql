-- ==============================================================================
-- PACHAS MIGRATION 12: GROUP INVITATIONS
-- Table for tracking email-based invitations to groups with token and status
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.group_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')) NOT NULL,
    token TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled', 'expired')) NOT NULL,
    custom_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc'::text, now()) + INTERVAL '14 days') NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_group_invitations_group_id ON public.group_invitations(group_id);
CREATE INDEX IF NOT EXISTS idx_group_invitations_email ON public.group_invitations(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_group_invitations_token ON public.group_invitations(token);
CREATE INDEX IF NOT EXISTS idx_group_invitations_status ON public.group_invitations(status);
