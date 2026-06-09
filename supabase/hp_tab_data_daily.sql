create table if not exists public.hp_tab_data_daily (
  data_date date primary key,
  payload jsonb not null default '{}'::jsonb,
  sources jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hp_tab_data_daily_synced_at_idx
  on public.hp_tab_data_daily (synced_at desc);

create or replace function public.set_hp_tab_data_daily_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.synced_at = coalesce(new.synced_at, now());
  return new;
end;
$$;

drop trigger if exists set_hp_tab_data_daily_updated_at
  on public.hp_tab_data_daily;

create trigger set_hp_tab_data_daily_updated_at
before update on public.hp_tab_data_daily
for each row
execute function public.set_hp_tab_data_daily_updated_at();

alter table public.hp_tab_data_daily enable row level security;

grant select, insert, update, delete
  on public.hp_tab_data_daily
  to service_role;

comment on table public.hp_tab_data_daily is
  'Daily cloud cache for HomePitch analytics tab data. Each row stores the GA4/GSC/platform payload needed to rebuild dashboard periods without refetching historical days.';
