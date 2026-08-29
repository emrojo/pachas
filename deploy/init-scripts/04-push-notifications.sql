-- ==============================================================================
-- PACHAS MIGRATION: PUSH NOTIFICATIONS & GROUP PREFERENCES
-- ==============================================================================
-- Adds notification preferences to group_members (default FALSE / disabled)
-- and creates public.push_subscriptions for WebPush / FCM device endpoints.
-- ==============================================================================

-- 1. Add notifications_enabled to group_members (defaults to FALSE for opt-in)
alter table public.group_members
add column if not exists notifications_enabled boolean default false not null;

-- 2. Push Subscriptions table for WebPush/FCM browser and mobile devices
create table if not exists public.push_subscriptions (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references public.profiles(id) on delete cascade not null,
    endpoint text not null unique,
    p256dh text not null,
    auth text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Indexes and permissions
create index if not exists idx_push_subscriptions_user on public.push_subscriptions(user_id);
grant all on table public.push_subscriptions to public, anon, authenticated, service_role;
