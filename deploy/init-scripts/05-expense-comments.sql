-- ==============================================================================
-- PACHAS MIGRATION: EXPENSE COMMENTS & DISCUSSIONS (FR-32)
-- ==============================================================================
-- Creates public.expense_comments for discussion threads on group expenses.
-- ==============================================================================

create table if not exists public.expense_comments (
    id text primary key,
    expense_id text references public.expenses(id) on delete cascade not null,
    user_id uuid references public.profiles(id) on delete cascade not null,
    comment text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_expense_comments_expense on public.expense_comments(expense_id);
create index if not exists idx_expense_comments_user on public.expense_comments(user_id);
create index if not exists idx_expense_comments_created on public.expense_comments(created_at asc);

grant all on table public.expense_comments to public, anon, authenticated, service_role;
