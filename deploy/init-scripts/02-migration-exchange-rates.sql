-- ==============================================================================
-- PACHAS MIGRATION: ADD EXCHANGE RATES TABLE
-- ==============================================================================
-- Safe, idempotent migration to create the centralized exchange_rates table
-- and configure its unique constraints, indexes, and permissions.
-- ==============================================================================

create table if not exists public.exchange_rates (
    id uuid primary key default uuid_generate_v4(),
    from_currency text not null,
    to_currency text not null,
    rate_date date not null,
    rate decimal(16, 6) not null check (rate > 0),
    provider text not null,
    is_estimated boolean default false not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(from_currency, to_currency, rate_date)
);

create index if not exists idx_exchange_rates_lookup on public.exchange_rates(from_currency, to_currency, rate_date);

-- Permissions
grant all on table public.exchange_rates to public, anon, authenticated, service_role;
