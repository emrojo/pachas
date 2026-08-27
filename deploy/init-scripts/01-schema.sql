-- ==============================================================================
-- PACHAS DATABASE SCHEMA & RLS POLICIES (AUTO-INITIALIZED ON DOCKER START)
-- ==============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Ensure auth schema and auth.users table exist for standalone PostgreSQL / PostgREST compatibility
create schema if not exists auth;

create table if not exists auth.users (
    id uuid primary key default uuid_generate_v4(),
    email text unique,
    raw_user_meta_data jsonb default '{}'::jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Function to resolve current user ID from JWT claim for Row Level Security (RLS)
create or replace function auth.uid()
returns uuid as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$ language sql stable;

-- 1. PROFILES TABLE (Linked to auth.users)
create table if not exists public.profiles (

    id uuid primary key references auth.users(id) on delete cascade,
    email text unique not null,
    full_name text not null,
    avatar_url text,
    bizum_phone text,
    role text default 'member' check (role in ('admin', 'member')) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Trigger to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.profiles (id, email, full_name, avatar_url, role)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        new.raw_user_meta_data->>'avatar_url',
        coalesce(new.raw_user_meta_data->>'role', 'member')
    );
    return new;
end;
$$ language plpgsql security definer set search_path = public;


drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();

-- 2. GROUPS TABLE
create table if not exists public.groups (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    description text,
    icon_emoji text default '✈️' not null,
    cover_image_url text,
    base_currency text default 'EUR' not null,
    invite_code text unique not null default substring(md5(random()::text) from 1 for 10),
    is_archived boolean default false not null,
    archived_at timestamp with time zone,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. GROUP MEMBERS TABLE
create table if not exists public.group_members (
    id uuid primary key default uuid_generate_v4(),
    group_id uuid references public.groups(id) on delete cascade not null,
    user_id uuid references public.profiles(id) on delete cascade not null,
    role text default 'member' check (role in ('admin', 'member')) not null,
    joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(group_id, user_id)
);

-- 4. EXPENSES TABLE
create table if not exists public.expenses (
    id uuid primary key default uuid_generate_v4(),
    group_id uuid references public.groups(id) on delete cascade not null,
    created_by uuid references public.profiles(id) on delete set null not null,
    title text not null,
    amount decimal(12, 2) not null check (amount > 0),
    currency text default 'EUR' not null,
    exchange_rate decimal(12, 6) default 1.0 not null,
    converted_amount decimal(12, 2) not null check (converted_amount > 0),
    category text default 'other' check (category in ('accommodation', 'food', 'transport', 'activities', 'shopping', 'other')) not null,
    expense_date date default current_date not null,
    receipt_url text,
    notes text,
    split_type text default 'EQUAL' check (split_type in ('EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES')) not null,
    latitude decimal(10, 7),
    longitude decimal(10, 7),
    location_name text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. EXPENSE PAYERS (Multiple people can pay for one expense)
create table if not exists public.expense_payers (
    id uuid primary key default uuid_generate_v4(),
    expense_id uuid references public.expenses(id) on delete cascade not null,
    user_id uuid references public.profiles(id) on delete cascade not null,
    amount_paid decimal(12, 2) not null check (amount_paid > 0),
    unique(expense_id, user_id)
);

-- 6. EXPENSE PARTICIPANTS (Who participates and what is their share)
create table if not exists public.expense_participants (
    id uuid primary key default uuid_generate_v4(),
    expense_id uuid references public.expenses(id) on delete cascade not null,
    user_id uuid references public.profiles(id) on delete cascade not null,
    amount_owed decimal(12, 2) not null check (amount_owed >= 0),
    percentage decimal(5, 2),
    shares decimal(5, 2),
    unique(expense_id, user_id)
);

-- 7. SETTLEMENTS (Direct debt payments between members)
create table if not exists public.settlements (
    id uuid primary key default uuid_generate_v4(),
    group_id uuid references public.groups(id) on delete cascade not null,
    from_user_id uuid references public.profiles(id) on delete cascade not null,
    to_user_id uuid references public.profiles(id) on delete cascade not null,
    amount decimal(12, 2) not null check (amount > 0),
    currency text default 'EUR' not null,
    payment_method text default 'BIZUM' check (payment_method in ('BIZUM', 'REVOLUT', 'CASH', 'BANK_TRANSFER', 'OTHER')) not null,
    notes text,
    settled_at timestamp with time zone default timezone('utc'::text, now()) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    check (from_user_id != to_user_id)
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_payers enable row level security;
alter table public.expense_participants enable row level security;
alter table public.settlements enable row level security;

-- Profiles: Authenticated users can ONLY view their own profile or profiles of members with whom they share at least one group
create policy "Users can view relevant profiles"
    on public.profiles for select
    to authenticated
    using (
        auth.uid() = id
        or exists (
            select 1 from public.group_members gm1
            join public.group_members gm2 on gm1.group_id = gm2.group_id
            where gm1.user_id = auth.uid()
            and gm2.user_id = profiles.id
        )
    );

create policy "Users can update own profile"
    on public.profiles for update
    to authenticated
    using (auth.uid() = id);

-- Groups: Users can view groups they are member of, created, or view by invite code
create policy "Members and invited users can view groups"
    on public.groups for select
    to authenticated
    using (
        exists (
            select 1 from public.group_members
            where group_members.group_id = groups.id
            and group_members.user_id = auth.uid()
        )
        or created_by = auth.uid()
        or invite_code is not null
    );


create policy "Authenticated users can create groups"
    on public.groups for insert
    to authenticated
    with check (auth.uid() = created_by);

create policy "Group admins/creator can update group"
    on public.groups for update
    to authenticated
    using (
        created_by = auth.uid()
        or exists (
            select 1 from public.group_members
            where group_members.group_id = groups.id
            and group_members.user_id = auth.uid()
            and group_members.role = 'admin'
        )
    );

create policy "Group creator can delete group"
    on public.groups for delete
    to authenticated
    using (created_by = auth.uid());

-- Group Members
create policy "Members can view members of their groups"
    on public.group_members for select
    to authenticated
    using (
        exists (
            select 1 from public.group_members gm
            where gm.group_id = group_members.group_id
            and gm.user_id = auth.uid()
        )
    );

create policy "Users can join groups"
    on public.group_members for insert
    to authenticated
    with check (auth.uid() = user_id);

create policy "Admins or self can remove members"
    on public.group_members for delete
    to authenticated
    using (
        auth.uid() = user_id
        or exists (
            select 1 from public.group_members gm
            where gm.group_id = group_members.group_id
            and gm.user_id = auth.uid()
            and gm.role = 'admin'
        )
    );

-- Expenses
create policy "Group members can view expenses"
    on public.expenses for select
    to authenticated
    using (
        exists (
            select 1 from public.group_members
            where group_members.group_id = expenses.group_id
            and group_members.user_id = auth.uid()
        )
    );

create policy "Group members can insert expenses"
    on public.expenses for insert
    to authenticated
    with check (
        exists (
            select 1 from public.group_members
            where group_members.group_id = expenses.group_id
            and group_members.user_id = auth.uid()
        )
    );

create policy "Expense creator or group admin can update expense"
    on public.expenses for update
    to authenticated
    using (
        created_by = auth.uid()
        or exists (
            select 1 from public.group_members gm
            where gm.group_id = expenses.group_id
            and gm.user_id = auth.uid()
            and gm.role = 'admin'
        )
    );

create policy "Expense creator or group admin can delete expense"
    on public.expenses for delete
    to authenticated
    using (
        created_by = auth.uid()
        or exists (
            select 1 from public.group_members gm
            where gm.group_id = expenses.group_id
            and gm.user_id = auth.uid()
            and gm.role = 'admin'
        )
    );

-- Expense Payers & Participants
create policy "Members can view payers"
    on public.expense_payers for select
    to authenticated
    using (
        exists (
            select 1 from public.expenses e
            join public.group_members gm on gm.group_id = e.group_id
            where e.id = expense_payers.expense_id
            and gm.user_id = auth.uid()
        )
    );

create policy "Members can insert payers"
    on public.expense_payers for insert
    to authenticated
    with check (
        exists (
            select 1 from public.expenses e
            join public.group_members gm on gm.group_id = e.group_id
            where e.id = expense_payers.expense_id
            and gm.user_id = auth.uid()
        )
    );

create policy "Expense creator or admin can update payers"
    on public.expense_payers for update
    to authenticated
    using (
        exists (
            select 1 from public.expenses e
            join public.group_members gm on gm.group_id = e.group_id
            where e.id = expense_payers.expense_id
            and (e.created_by = auth.uid() or (gm.user_id = auth.uid() and gm.role = 'admin'))
        )
    );

create policy "Expense creator or admin can delete payers"
    on public.expense_payers for delete
    to authenticated
    using (
        exists (
            select 1 from public.expenses e
            join public.group_members gm on gm.group_id = e.group_id
            where e.id = expense_payers.expense_id
            and (e.created_by = auth.uid() or (gm.user_id = auth.uid() and gm.role = 'admin'))
        )
    );

create policy "Members can view participants"
    on public.expense_participants for select
    to authenticated
    using (
        exists (
            select 1 from public.expenses e
            join public.group_members gm on gm.group_id = e.group_id
            where e.id = expense_participants.expense_id
            and gm.user_id = auth.uid()
        )
    );

create policy "Members can insert participants"
    on public.expense_participants for insert
    to authenticated
    with check (
        exists (
            select 1 from public.expenses e
            join public.group_members gm on gm.group_id = e.group_id
            where e.id = expense_participants.expense_id
            and gm.user_id = auth.uid()
        )
    );

create policy "Expense creator or admin can update participants"
    on public.expense_participants for update
    to authenticated
    using (
        exists (
            select 1 from public.expenses e
            join public.group_members gm on gm.group_id = e.group_id
            where e.id = expense_participants.expense_id
            and (e.created_by = auth.uid() or (gm.user_id = auth.uid() and gm.role = 'admin'))
        )
    );

create policy "Expense creator or admin can delete participants"
    on public.expense_participants for delete
    to authenticated
    using (
        exists (
            select 1 from public.expenses e
            join public.group_members gm on gm.group_id = e.group_id
            where e.id = expense_participants.expense_id
            and (e.created_by = auth.uid() or (gm.user_id = auth.uid() and gm.role = 'admin'))
        )
    );

-- Settlements
create policy "Members can view settlements"
    on public.settlements for select
    to authenticated
    using (
        exists (
            select 1 from public.group_members
            where group_members.group_id = settlements.group_id
            and group_members.user_id = auth.uid()
        )
    );

create policy "Members can insert settlements"
    on public.settlements for insert
    to authenticated
    with check (
        exists (
            select 1 from public.group_members
            where group_members.group_id = settlements.group_id
            and group_members.user_id = auth.uid()
        )
    );

create policy "Settlement payer or admin can delete settlement"
    on public.settlements for delete
    to authenticated
    using (
        from_user_id = auth.uid()
        or exists (
            select 1 from public.group_members gm
            where gm.group_id = settlements.group_id
            and gm.user_id = auth.uid()
            and gm.role = 'admin'
        )
    );

create policy "Settlement payer or admin can update settlement"
    on public.settlements for update
    to authenticated
    using (
        from_user_id = auth.uid()
        or exists (
            select 1 from public.group_members gm
            where gm.group_id = settlements.group_id
            and gm.user_id = auth.uid()
            and gm.role = 'admin'
        )
    );

