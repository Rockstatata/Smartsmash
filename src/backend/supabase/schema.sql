-- SmartSmash Supabase bootstrap schema
-- Run in Supabase SQL editor

create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leaderboard (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  elo numeric not null default 1500,
  winrate numeric not null default 0,
  points integer not null default 0,
  matches integer not null default 0,
  color text not null default '#4A9EFF',
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.match_history (
  id text primary key,
  agent1 text not null,
  agent2 text not null,
  score jsonb not null,
  winner text not null,
  rally_count integer not null,
  timestamp timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.leaderboard enable row level security;
alter table public.match_history enable row level security;

-- profiles: users can read/update their own profile.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- leaderboard and history can be publicly readable.
drop policy if exists "leaderboard_public_read" on public.leaderboard;
create policy "leaderboard_public_read"
  on public.leaderboard for select
  using (true);

drop policy if exists "match_history_public_read" on public.match_history;
create policy "match_history_public_read"
  on public.match_history for select
  using (true);

-- seed leaderboard rows
insert into public.leaderboard (name, elo, winrate, points, matches, color, description)
values
  ('Minimax', 1847, 72.5, 2450, 48, '#4A9EFF', 'Depth-limited search with alpha-beta pruning'),
  ('MCTS', 1792, 65.8, 2180, 48, '#A855F7', 'Monte Carlo Tree Search with UCT selection'),
  ('Fuzzy', 1685, 52.1, 1720, 48, '#4ade80', 'Fuzzy logic rule-based inference system')
on conflict (name) do update set
  elo = excluded.elo,
  winrate = excluded.winrate,
  points = excluded.points,
  matches = excluded.matches,
  color = excluded.color,
  description = excluded.description,
  updated_at = now();

-- storage bucket for SmartSmash files
insert into storage.buckets (id, name, public)
values ('smartsmash-assets', 'smartsmash-assets', true)
on conflict (id) do nothing;

-- storage read policy
drop policy if exists "smartsmash_assets_public_read" on storage.objects;
create policy "smartsmash_assets_public_read"
on storage.objects for select
using (bucket_id = 'smartsmash-assets');

-- storage write/delete policy for authenticated users under their own folder prefix.
drop policy if exists "smartsmash_assets_user_write" on storage.objects;
create policy "smartsmash_assets_user_write"
on storage.objects for insert
with check (
  bucket_id = 'smartsmash-assets'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "smartsmash_assets_user_delete" on storage.objects;
create policy "smartsmash_assets_user_delete"
on storage.objects for delete
using (
  bucket_id = 'smartsmash-assets'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);
