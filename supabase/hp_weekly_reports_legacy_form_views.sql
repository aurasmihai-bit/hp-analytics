alter table if exists public.hp_analytics_weekly_reports
  add column if not exists legacy_form_views integer not null default 0;

comment on column public.hp_analytics_weekly_reports.legacy_form_views is
  'Views on legacy request-form routes during the weekly reporting interval.';
