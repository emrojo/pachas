-- ==============================================================================
-- PACHAS MIGRATION: GROUP CHAT MESSAGES (FR-40)
-- ==============================================================================
-- Creates public.group_messages for real-time discussion inside group trips.
-- ==============================================================================

create table if not exists public.group_messages (
    id uuid primary key default uuid_generate_v4(),
    group_id uuid references public.groups(id) on delete cascade not null,
    user_id uuid references public.profiles(id) on delete cascade not null,
    message text not null,
    gif_url text,
    reactions jsonb default '{}'::jsonb,
    expense_id uuid references public.expenses(id) on delete cascade,
    reply_to_id uuid references public.group_messages(id) on delete set null,
    reply_to_snippet jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_group_messages_group on public.group_messages(group_id);
create index if not exists idx_group_messages_user on public.group_messages(user_id);
create index if not exists idx_group_messages_expense on public.group_messages(expense_id);
create index if not exists idx_group_messages_reply on public.group_messages(reply_to_id);
create index if not exists idx_group_messages_created on public.group_messages(created_at asc);

grant all on table public.group_messages to public, anon, authenticated, service_role;
