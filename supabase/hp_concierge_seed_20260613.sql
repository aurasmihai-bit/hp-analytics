-- HomePitch Analytics: manual import for the concierge request received by email on 2026-06-13.
-- Ruleaza dupa `supabase/hp_concierge_crm.sql` in proiectul Supabase hp-analytics.

INSERT INTO public.hp_concierge_imported_requests (
  id,
  full_name,
  email,
  phone,
  message,
  status,
  source_label,
  created_at,
  updated_at
)
VALUES (
  '4c8160f9-6330-4f5a-a90d-7f6f40adcb8f',
  'A.',
  'aurasmihai@gmail.com',
  '0729176494',
  'Servicii selectate:
- 1 x Compară 3 proprietăți (49 €) = 49 €
Total estimat: 49 €

Mesaj client:
sadsda

Disclaimer acceptat: da',
  'nou',
  'email_import_2026-06-13_21:23',
  '2026-06-13 21:23:00+03',
  now()
)
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  message = EXCLUDED.message,
  status = EXCLUDED.status,
  source_label = EXCLUDED.source_label,
  created_at = EXCLUDED.created_at,
  updated_at = now();

INSERT INTO public.hp_concierge_crm (
  request_id,
  stage,
  contact_status,
  services,
  final_total_eur,
  payment_status,
  comments,
  final_notes,
  updated_at
)
VALUES (
  '4c8160f9-6330-4f5a-a90d-7f6f40adcb8f',
  'nou',
  'necontactat',
  '[{"id":"compara-3-proprietati","title":"Compară 3 proprietăți","quantity":1,"unit_price_eur":49,"subtotal_eur":49}]'::jsonb,
  49,
  'not_created',
  '[]'::jsonb,
  'Importat din email concierge trimis la 13 iun. 2026, 21:23.',
  now()
)
ON CONFLICT (request_id) DO UPDATE SET
  services = EXCLUDED.services,
  final_total_eur = EXCLUDED.final_total_eur,
  payment_status = EXCLUDED.payment_status,
  final_notes = COALESCE(NULLIF(public.hp_concierge_crm.final_notes, ''), EXCLUDED.final_notes),
  updated_at = now();
