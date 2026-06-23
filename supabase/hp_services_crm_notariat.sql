-- Extend the existing Concierge CRM tables into a generic services CRM.
-- Keeps existing concierge data and allows service_type = 'notariat' for /servicii-notariat.

alter table if exists public.hp_concierge_imported_requests
  add column if not exists service_type text not null default 'concierge';

alter table if exists public.hp_concierge_crm
  add column if not exists service_type text not null default 'concierge';

update public.hp_concierge_imported_requests
set service_type = 'concierge'
where service_type is null;

update public.hp_concierge_crm
set service_type = 'concierge'
where service_type is null;

alter table if exists public.hp_concierge_imported_requests
  drop constraint if exists hp_concierge_imported_requests_service_type_check;

alter table if exists public.hp_concierge_imported_requests
  add constraint hp_concierge_imported_requests_service_type_check
  check (service_type ~ '^[a-z0-9_-]{2,80}$');

alter table if exists public.hp_concierge_crm
  drop constraint if exists hp_concierge_crm_service_type_check;

alter table if exists public.hp_concierge_crm
  add constraint hp_concierge_crm_service_type_check
  check (service_type ~ '^[a-z0-9_-]{2,80}$');

create index if not exists hp_concierge_imported_requests_service_type_created_idx
  on public.hp_concierge_imported_requests (service_type, created_at desc);

create index if not exists hp_concierge_crm_service_type_stage_idx
  on public.hp_concierge_crm (service_type, stage, updated_at desc);
