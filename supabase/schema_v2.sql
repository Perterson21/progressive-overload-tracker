-- Progressive Overload Tracker V2
-- Run this file once in Supabase SQL Editor.
-- The legacy public.workouts table is intentionally left untouched during migration.

create extension if not exists pgcrypto;

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  muscle_group text not null,
  equipment text,
  created_at timestamptz default now() not null
);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  notes text,
  session_date date default current_date not null,
  created_at timestamptz default now() not null
);

create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.workout_sessions(id) on delete cascade not null,
  exercise_id uuid references public.exercises(id) on delete restrict not null,
  set_number integer not null check (set_number > 0),
  weight_kg numeric(6,2) not null check (weight_kg >= 0),
  reps integer not null check (reps > 0),
  rpe numeric(3,1) check (rpe is null or (rpe >= 6 and rpe <= 10)),
  is_warmup boolean default false not null,
  created_at timestamptz default now() not null,
  unique (session_id, exercise_id, set_number)
);

create index if not exists workout_sessions_user_date_idx
  on public.workout_sessions (user_id, session_date desc);

create index if not exists workout_sets_session_idx
  on public.workout_sets (session_id);

create index if not exists workout_sets_exercise_idx
  on public.workout_sets (exercise_id);

alter table public.exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_sets enable row level security;

drop policy if exists "Authenticated users can view exercises" on public.exercises;
create policy "Authenticated users can view exercises"
on public.exercises
for select
to authenticated
using (true);

drop policy if exists "Users can view own sessions" on public.workout_sessions;
create policy "Users can view own sessions"
on public.workout_sessions
for select
using (auth.uid() = user_id);

drop policy if exists "Users can create own sessions" on public.workout_sessions;
create policy "Users can create own sessions"
on public.workout_sessions
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own sessions" on public.workout_sessions;
create policy "Users can update own sessions"
on public.workout_sessions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own sessions" on public.workout_sessions;
create policy "Users can delete own sessions"
on public.workout_sessions
for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view own sets" on public.workout_sets;
create policy "Users can view own sets"
on public.workout_sets
for select
using (
  exists (
    select 1
    from public.workout_sessions
    where workout_sessions.id = workout_sets.session_id
      and workout_sessions.user_id = auth.uid()
  )
);

drop policy if exists "Users can create own sets" on public.workout_sets;
create policy "Users can create own sets"
on public.workout_sets
for insert
with check (
  exists (
    select 1
    from public.workout_sessions
    where workout_sessions.id = workout_sets.session_id
      and workout_sessions.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own sets" on public.workout_sets;
create policy "Users can update own sets"
on public.workout_sets
for update
using (
  exists (
    select 1
    from public.workout_sessions
    where workout_sessions.id = workout_sets.session_id
      and workout_sessions.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workout_sessions
    where workout_sessions.id = workout_sets.session_id
      and workout_sessions.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own sets" on public.workout_sets;
create policy "Users can delete own sets"
on public.workout_sets
for delete
using (
  exists (
    select 1
    from public.workout_sessions
    where workout_sessions.id = workout_sets.session_id
      and workout_sessions.user_id = auth.uid()
  )
);

insert into public.exercises (name, muscle_group, equipment) values
  ('Incline Dumbbell Press', 'Chest', 'Dumbbell'),
  ('Bench Press', 'Chest', 'Barbell'),
  ('Chest Press', 'Chest', 'Machine'),
  ('Cable Fly', 'Chest', 'Cable'),
  ('Pull-up', 'Back', 'Bodyweight'),
  ('Weighted Pull-up', 'Back', 'Bodyweight'),
  ('Lat Pulldown', 'Back', 'Cable'),
  ('Barbell Row', 'Back', 'Barbell'),
  ('Seated Cable Row', 'Back', 'Cable'),
  ('Shoulder Press', 'Shoulders', 'Dumbbell'),
  ('Lateral Raise', 'Shoulders', 'Dumbbell'),
  ('Rear Delt Fly', 'Shoulders', 'Machine'),
  ('Bicep Curl', 'Arms', 'Dumbbell'),
  ('Hammer Curl', 'Arms', 'Dumbbell'),
  ('Tricep Pushdown', 'Arms', 'Cable'),
  ('Overhead Tricep Extension', 'Arms', 'Cable'),
  ('Squat', 'Legs', 'Barbell'),
  ('Leg Press', 'Legs', 'Machine'),
  ('Romanian Deadlift', 'Legs', 'Barbell'),
  ('Leg Curl', 'Legs', 'Machine'),
  ('Leg Extension', 'Legs', 'Machine'),
  ('Calf Raise', 'Legs', 'Machine')
on conflict (name) do nothing;
