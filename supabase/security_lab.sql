-- Safe cross-device credential-capture simulation.
-- This table is intentionally restricted to dummy credentials only.
-- Real-looking emails/passwords are rejected at the database layer.

create table if not exists public.security_lab_captures (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  email text not null check (lower(email) like '%@example.com'),
  demo_password text not null check (demo_password like 'demo-%'),
  user_agent text,
  captured_at timestamptz not null default now()
);

alter table public.security_lab_captures enable row level security;

drop policy if exists "security lab insert dummy captures" on public.security_lab_captures;
create policy "security lab insert dummy captures"
on public.security_lab_captures
for insert
to anon, authenticated
with check (
  lower(email) like '%@example.com'
  and demo_password like 'demo-%'
);

drop policy if exists "security lab owner select" on public.security_lab_captures;
create policy "security lab owner select"
on public.security_lab_captures
for select
to authenticated
using (auth.uid() = owner_user_id);

drop policy if exists "security lab owner delete" on public.security_lab_captures;
create policy "security lab owner delete"
on public.security_lab_captures
for delete
to authenticated
using (auth.uid() = owner_user_id);

create index if not exists security_lab_captures_owner_time_idx
  on public.security_lab_captures (owner_user_id, captured_at desc);
