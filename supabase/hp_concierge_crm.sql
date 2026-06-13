-- HomePitch Analytics: Concierge CRM storage.
-- Ruleaza acest SQL in proiectul Supabase al dashboardului hp-analytics (rstihjcnuazzyksdwczp).
-- Datele brute ale cererii raman in Supabase HomePitch; aici salvam doar statusul CRM intern.

CREATE TABLE IF NOT EXISTS public.hp_concierge_crm (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  stage text NOT NULL DEFAULT 'nou',
  contact_status text,
  owner text,
  comments jsonb NOT NULL DEFAULT '[]'::jsonb,
  services jsonb NOT NULL DEFAULT '[]'::jsonb,
  final_total_eur numeric(10,2),
  final_notes text,
  stripe_session_id text,
  stripe_payment_url text,
  payment_status text NOT NULL DEFAULT 'not_created',
  payment_checked_at timestamptz,
  reminder_sent_at timestamptz,
  reminder_count integer NOT NULL DEFAULT 0,
  after_payment_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hp_concierge_crm_request_unique UNIQUE (request_id),
  CONSTRAINT hp_concierge_crm_stage_check CHECK (
    stage IN ('nou','contactare','consultanta','oferta_finala','plata_trimis','platit','livrare','inchis','pierdut')
  ),
  CONSTRAINT hp_concierge_crm_payment_status_check CHECK (
    payment_status IN ('not_created','pending','paid','expired','cancelled','failed')
  ),
  CONSTRAINT hp_concierge_crm_services_array CHECK (jsonb_typeof(services) = 'array'),
  CONSTRAINT hp_concierge_crm_comments_array CHECK (jsonb_typeof(comments) = 'array')
);

CREATE INDEX IF NOT EXISTS hp_concierge_crm_request_id_idx ON public.hp_concierge_crm(request_id);
CREATE INDEX IF NOT EXISTS hp_concierge_crm_stage_idx ON public.hp_concierge_crm(stage);
CREATE INDEX IF NOT EXISTS hp_concierge_crm_payment_status_idx ON public.hp_concierge_crm(payment_status);
CREATE INDEX IF NOT EXISTS hp_concierge_crm_updated_at_idx ON public.hp_concierge_crm(updated_at DESC);

CREATE TABLE IF NOT EXISTS public.hp_concierge_imported_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'nou',
  admin_notes text,
  source_label text NOT NULL DEFAULT 'email_import',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hp_concierge_imported_requests_email_idx
  ON public.hp_concierge_imported_requests(email);
CREATE INDEX IF NOT EXISTS hp_concierge_imported_requests_created_at_idx
  ON public.hp_concierge_imported_requests(created_at DESC);

CREATE OR REPLACE FUNCTION public.hp_concierge_crm_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hp_concierge_crm_updated_at ON public.hp_concierge_crm;
CREATE TRIGGER hp_concierge_crm_updated_at
  BEFORE UPDATE ON public.hp_concierge_crm
  FOR EACH ROW
  EXECUTE FUNCTION public.hp_concierge_crm_set_updated_at();

DROP TRIGGER IF EXISTS hp_concierge_imported_requests_updated_at ON public.hp_concierge_imported_requests;
CREATE TRIGGER hp_concierge_imported_requests_updated_at
  BEFORE UPDATE ON public.hp_concierge_imported_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.hp_concierge_crm_set_updated_at();

ALTER TABLE public.hp_concierge_crm ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hp_concierge_imported_requests ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.hp_concierge_crm
  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.hp_concierge_imported_requests
  TO service_role;

COMMENT ON TABLE public.hp_concierge_crm IS
  'Internal CRM state for /concierge requests: contact flow, edited services, final price, Stripe link, payment checks and post-payment status.';

COMMENT ON TABLE public.hp_concierge_imported_requests IS
  'Manual imports for /concierge requests received by email when direct HomePitch platform access is not available.';
