-- CRM operational pentru flow-urile cerere-oferta:
-- 1) cumparatori cu oferte primite, dar fara raspuns
-- 2) agenti/proprietari/ansambluri cu recomandari AI aprobate, dar fara oferta trimisa

CREATE TABLE IF NOT EXISTS public.hp_request_offer_crm_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL CHECK (source_type IN ('offer_no_response', 'recommendation_no_offer')),
  source_id text NOT NULL,
  offer_id text,
  recommendation_id text,
  request_id text,
  property_id text,
  request_url text,
  property_url text,
  request_title text,
  request_description text,
  property_title text,
  transaction_type text,
  request_author_name text,
  request_author_email text,
  request_author_phone text,
  request_author_user_type text,
  counterparty_name text,
  counterparty_email text,
  counterparty_phone text,
  counterparty_user_type text,
  price numeric,
  currency text,
  city text,
  neighborhood text,
  financing text,
  down_payment numeric,
  down_payment_currency text,
  pre_approval text,
  deadline text,
  buyer_score numeric,
  ai_score numeric,
  source_created_at timestamptz,
  source_received_at timestamptz,
  source_status text,
  reminder_count integer NOT NULL DEFAULT 0,
  reminder_channels jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_reminder_at timestamptz,
  stage text NOT NULL DEFAULT 'nou' CHECK (stage IN ('nou', 'contactat', 'nu_raspunde', 'refuz', 'pending_actiune', 'inchis_manual')),
  comments jsonb NOT NULL DEFAULT '[]'::jsonb,
  log jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_hp_request_offer_crm_cases_source_type
  ON public.hp_request_offer_crm_cases(source_type);

CREATE INDEX IF NOT EXISTS idx_hp_request_offer_crm_cases_stage
  ON public.hp_request_offer_crm_cases(stage);

CREATE INDEX IF NOT EXISTS idx_hp_request_offer_crm_cases_received_at
  ON public.hp_request_offer_crm_cases(source_received_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_hp_request_offer_crm_cases_request_id
  ON public.hp_request_offer_crm_cases(request_id);

CREATE INDEX IF NOT EXISTS idx_hp_request_offer_crm_cases_property_id
  ON public.hp_request_offer_crm_cases(property_id);

ALTER TABLE public.hp_request_offer_crm_cases
  ADD COLUMN IF NOT EXISTS request_description text,
  ADD COLUMN IF NOT EXISTS financing text,
  ADD COLUMN IF NOT EXISTS down_payment numeric,
  ADD COLUMN IF NOT EXISTS down_payment_currency text,
  ADD COLUMN IF NOT EXISTS pre_approval text,
  ADD COLUMN IF NOT EXISTS deadline text;

CREATE OR REPLACE FUNCTION public.set_hp_request_offer_crm_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hp_request_offer_crm_updated_at ON public.hp_request_offer_crm_cases;
CREATE TRIGGER trg_hp_request_offer_crm_updated_at
  BEFORE UPDATE ON public.hp_request_offer_crm_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.set_hp_request_offer_crm_updated_at();

ALTER TABLE public.hp_request_offer_crm_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages request offer CRM cases" ON public.hp_request_offer_crm_cases;
CREATE POLICY "Service role manages request offer CRM cases"
  ON public.hp_request_offer_crm_cases
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hp_request_offer_crm_cases TO service_role;
