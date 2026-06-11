create table if not exists public.pending_checkouts (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        references auth.users(id),
  session_id   text,
  pixels       jsonb       not null,
  audio_url    text,
  pseudo       text,
  description  text,
  status       text        not null default 'pending',
  created_at   timestamptz not null default now()
);

alter table public.pending_checkouts enable row level security;

-- Only the service role (used by Edge Functions) can read/write this table.
-- No user-facing RLS policy is needed.
