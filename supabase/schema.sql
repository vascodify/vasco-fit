-- ============================================================================
-- V.A.S.C.O. (Voice-Activated Strength & Correlation Oracle)
-- Supabase PostgreSQL Schema (Blueprint & Instance Model + Realtime WebSockets)
-- Paste this into your Supabase SQL Editor and click "Run"
-- ============================================================================

create extension if not exists "uuid-ossp";

-- 1. EXERCISE BLUEPRINTS TABLE (Defines what is measured & its modifiers)
create table if not exists public.exercises (
  id text primary key,
  name text not null,
  category text not null default 'calisthenics',
  is_active_focus boolean not null default true,
  metrics jsonb not null default '[]'::jsonb,
  modifier jsonb default null,
  created_at timestamptz not null default now()
);

-- 2. LOGS TABLE (Decoupled logging instances referencing Exercise Blueprints)
create table if not exists public.logs (
  id text primary key,
  exercise_id text not null references public.exercises(id) on delete cascade,
  timestamp timestamptz not null default now(),
  metric_values jsonb not null default '{}'::jsonb,
  modifier_value text default null,
  session_tags jsonb not null default '[]'::jsonb,
  notes text,
  raw_transcript text
);

-- Enable Row Level Security (Open for MVP anon key usage)
alter table public.exercises enable row level security;
alter table public.logs enable row level security;

drop policy if exists "Allow public read/write on exercises" on public.exercises;
create policy "Allow public read/write on exercises" on public.exercises for all using (true) with check (true);

drop policy if exists "Allow public read/write on logs" on public.logs;
create policy "Allow public read/write on logs" on public.logs for all using (true) with check (true);

-- Enable Supabase Realtime WebSockets on exercises and logs
alter publication supabase_realtime add table public.exercises;
alter publication supabase_realtime add table public.logs;
