create table if not exists public.hp_action_backlog (
  recommendation_id text primary key,
  status text not null default 'nou'
    check (status in ('nou', 'in_lucru', 'masurare', 'inchis')),
  owner text,
  ignored boolean not null default false,
  verification jsonb,
  type text,
  title text,
  body text,
  fix text,
  metric text,
  urgency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hp_action_backlog_status_idx
  on public.hp_action_backlog (status);

create index if not exists hp_action_backlog_updated_at_idx
  on public.hp_action_backlog (updated_at desc);

create or replace function public.set_hp_action_backlog_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = coalesce(new.updated_at, now());
  return new;
end;
$$;

drop trigger if exists set_hp_action_backlog_updated_at
  on public.hp_action_backlog;

create trigger set_hp_action_backlog_updated_at
before update on public.hp_action_backlog
for each row
execute function public.set_hp_action_backlog_updated_at();

alter table public.hp_action_backlog enable row level security;

grant select, insert, update, delete
  on public.hp_action_backlog
  to service_role;

comment on table public.hp_action_backlog is
  'Shared action/recommendation backlog state for the HomePitch analytics dashboard. Access goes through the server API using the Supabase service role key.';
