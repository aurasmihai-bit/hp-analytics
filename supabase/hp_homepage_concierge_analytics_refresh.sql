-- Refresh cached daily analytics payloads after adding:
-- - Homepages A/B analysis for /, /home3, /invers, /simplu, /platforma
-- - /concierge traffic analysis with referrers, devices, bounce and conversion metrics
--
-- Run in the hp-analytics Supabase project.

update public.hp_tab_data_daily
set payload = payload - 'conciergeTraffic',
    updated_at = now()
where data_date >= current_date - interval '120 days';
