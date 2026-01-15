-- =============================================
-- PrimeStrideAI KMS - Database Schema
-- =============================================
-- Run this SQL in Supabase SQL Editor to create all tables
-- =============================================

-- Documents (one row per doc)
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  doc_id text unique not null,                 -- e.g., PS-DIAG-001
  title text not null,
  google_doc_url text not null,
  current_version text not null default 'v1.1',
  status text not null default 'learning-enabled',
  created_at timestamptz not null default now()
);

-- Versions (history)
create table if not exists public.doc_versions (
  id uuid primary key default gen_random_uuid(),
  doc_id text not null references public.documents(doc_id) on delete cascade,
  version text not null,
  change_summary text,
  hypothesis text,
  created_at timestamptz not null default now(),
  unique (doc_id, version)
);

-- Users (simple internal users for now)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  name text,
  created_at timestamptz not null default now()
);

-- Events (heart of learning)
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_email text,
  doc_id text not null references public.documents(doc_id) on delete cascade,
  version text not null,
  event_type text not null check (event_type in ('open', 'feedback', 'reopen')),
  value text check (value in ('helped', 'not_confident', 'didnt_help')),
  notes text
);

-- Helpful indexes for rollups
create index if not exists idx_events_doc_version on public.events(doc_id, version, created_at);
create index if not exists idx_events_type on public.events(event_type);

-- =============================================
-- Row Level Security (RLS) - Optional but recommended
-- =============================================
-- For now, we'll use anon key with open access
-- In production, you'd want to add proper RLS policies

alter table public.documents enable row level security;
alter table public.doc_versions enable row level security;
alter table public.users enable row level security;
alter table public.events enable row level security;

-- Allow all operations for authenticated and anon users (development mode)
create policy "Allow all on documents" on public.documents for all using (true) with check (true);
create policy "Allow all on doc_versions" on public.doc_versions for all using (true) with check (true);
create policy "Allow all on users" on public.users for all using (true) with check (true);
create policy "Allow all on events" on public.events for all using (true) with check (true);
