create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  level text,
  oven_type text,
  has_robot boolean default false,
  exam_session text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_num int not null check (week_num between 1 and 56),
  status text not null default 'not_started' check (status in ('not_started', 'started', 'completed')),
  active_session int not null default 1 check (active_session between 1 and 5),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, week_num)
);

create table if not exists public.user_week_checklists (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_num int not null check (week_num between 1 and 56),
  theory_read boolean not null default false,
  sheet_viewed boolean not null default false,
  recipe_tested boolean not null default false,
  note_added boolean not null default false,
  coach_question boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, week_num)
);

create table if not exists public.user_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null,
  week_num int check (week_num between 1 and 56),
  session_num int check (session_num between 1 and 5),
  sheet_title text,
  category text,
  title text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

create table if not exists public.user_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('technical_sheet', 'glossary')),
  item_key text not null,
  title text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_type, item_key)
);

create table if not exists public.user_sheet_statuses (
  user_id uuid not null references auth.users(id) on delete cascade,
  sheet_title text not null,
  status text not null check (status in ('to_review', 'mastered', 'to_practice')),
  updated_at timestamptz not null default now(),
  primary key (user_id, sheet_title)
);

create table if not exists public.quiz_results (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_num int not null check (week_num between 1 and 56),
  score int not null default 0 check (score >= 0),
  total int not null default 0 check (total >= 0),
  answers jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now(),
  primary key (user_id, week_num)
);

create table if not exists public.exam_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null default 'local-current',
  title text not null default 'Examen blanc',
  timer_seconds int not null default 0 check (timer_seconds >= 0),
  productions jsonb not null default '{}'::jsonb,
  gesture_scores jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

create table if not exists public.recent_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null,
  title text not null,
  target_tab text not null,
  extra jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, item_type, title)
);

create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_num int not null check (week_num between 1 and 56),
  session_num int not null check (session_num between 1 and 5),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists user_progress_set_updated_at on public.user_progress;
create trigger user_progress_set_updated_at
before update on public.user_progress
for each row execute function public.set_updated_at();

drop trigger if exists user_week_checklists_set_updated_at on public.user_week_checklists;
create trigger user_week_checklists_set_updated_at
before update on public.user_week_checklists
for each row execute function public.set_updated_at();

drop trigger if exists user_notes_set_updated_at on public.user_notes;
create trigger user_notes_set_updated_at
before update on public.user_notes
for each row execute function public.set_updated_at();

drop trigger if exists user_sheet_statuses_set_updated_at on public.user_sheet_statuses;
create trigger user_sheet_statuses_set_updated_at
before update on public.user_sheet_statuses
for each row execute function public.set_updated_at();

drop trigger if exists exam_sessions_set_updated_at on public.exam_sessions;
create trigger exam_sessions_set_updated_at
before update on public.exam_sessions
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.user_progress enable row level security;
alter table public.user_week_checklists enable row level security;
alter table public.user_notes enable row level security;
alter table public.user_favorites enable row level security;
alter table public.user_sheet_statuses enable row level security;
alter table public.quiz_results enable row level security;
alter table public.exam_sessions enable row level security;
alter table public.recent_history enable row level security;
alter table public.coach_messages enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.user_progress to authenticated;
grant select, insert, update, delete on public.user_week_checklists to authenticated;
grant select, insert, update, delete on public.user_notes to authenticated;
grant select, insert, update, delete on public.user_favorites to authenticated;
grant select, insert, update, delete on public.user_sheet_statuses to authenticated;
grant select, insert, update, delete on public.quiz_results to authenticated;
grant select, insert, update, delete on public.exam_sessions to authenticated;
grant select, insert, update, delete on public.recent_history to authenticated;
grant select, insert, update, delete on public.coach_messages to authenticated;

drop policy if exists "profiles_owner_all" on public.profiles;
create policy "profiles_owner_all" on public.profiles
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_progress_owner_all" on public.user_progress;
create policy "user_progress_owner_all" on public.user_progress
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_week_checklists_owner_all" on public.user_week_checklists;
create policy "user_week_checklists_owner_all" on public.user_week_checklists
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_notes_owner_all" on public.user_notes;
create policy "user_notes_owner_all" on public.user_notes
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_favorites_owner_all" on public.user_favorites;
create policy "user_favorites_owner_all" on public.user_favorites
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_sheet_statuses_owner_all" on public.user_sheet_statuses;
create policy "user_sheet_statuses_owner_all" on public.user_sheet_statuses
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "quiz_results_owner_all" on public.quiz_results;
create policy "quiz_results_owner_all" on public.quiz_results
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "exam_sessions_owner_all" on public.exam_sessions;
create policy "exam_sessions_owner_all" on public.exam_sessions
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "recent_history_owner_all" on public.recent_history;
create policy "recent_history_owner_all" on public.recent_history
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "coach_messages_owner_all" on public.coach_messages;
create policy "coach_messages_owner_all" on public.coach_messages
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists user_notes_user_week_idx on public.user_notes(user_id, week_num, session_num);
create index if not exists recent_history_user_updated_idx on public.recent_history(user_id, updated_at desc);
create index if not exists coach_messages_user_week_session_idx on public.coach_messages(user_id, week_num, session_num, created_at);
