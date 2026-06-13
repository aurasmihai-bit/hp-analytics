-- HomePitch Analytics: Concierge CRM storage.
-- Ruleaza acest SQL in proiectul HomePitch Supabase (bwfexvoapabfvkmmnxkg).

CREATE TABLE IF NOT EXISTS public.hp_concierge_crm (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.concierge_requests(id) ON DELETE CASCADE,
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

ALTER TABLE public.hp_concierge_crm ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage concierge crm" ON public.hp_concierge_crm;
CREATE POLICY "Admins can manage concierge crm"
  ON public.hp_concierge_crm
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

COMMENT ON TABLE public.hp_concierge_crm IS
  'Internal CRM state for /concierge requests: contact flow, edited services, final price, Stripe link, payment checks and post-payment status.';

CREATE TABLE IF NOT EXISTS public.hp_concierge_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.concierge_requests(id) ON DELETE CASCADE,
  email_type text NOT NULL DEFAULT 'admin_notification',
  recipient text,
  status text NOT NULL,
  provider text NOT NULL DEFAULT 'brevo',
  provider_message_id text,
  error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hp_concierge_email_log_status_check CHECK (status IN ('sent','failed','skipped'))
);

CREATE INDEX IF NOT EXISTS hp_concierge_email_log_request_idx ON public.hp_concierge_email_log(request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS hp_concierge_email_log_status_idx ON public.hp_concierge_email_log(status);

ALTER TABLE public.hp_concierge_email_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view concierge email log" ON public.hp_concierge_email_log;
CREATE POLICY "Admins can view concierge email log"
  ON public.hp_concierge_email_log
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

COMMENT ON TABLE public.hp_concierge_email_log IS
  'Audit log for concierge notification/reminder emails. Used by hp-analytics Concierge CRM to verify whether email sending was accepted by provider.';
