-- HomePitch Analytics: add finalizata stage to Concierge CRM.
-- Ruleaza in Supabase analytics (rstihjcnuazzyksdwczp) daca tabela hp_concierge_crm exista deja.

UPDATE public.hp_concierge_crm
SET stage = CASE stage
  WHEN 'inchis' THEN 'finalizata'
  WHEN 'finalizat' THEN 'finalizata'
  WHEN 'closed' THEN 'finalizata'
  WHEN 'completed' THEN 'finalizata'
  ELSE stage
END
WHERE stage IN ('inchis','finalizat','closed','completed');

ALTER TABLE public.hp_concierge_crm
  DROP CONSTRAINT IF EXISTS hp_concierge_crm_stage_check;

ALTER TABLE public.hp_concierge_crm
  ADD CONSTRAINT hp_concierge_crm_stage_check CHECK (
    stage IN (
      'nou',
      'contactat',
      'nu_a_raspuns',
      'discutie_consultanta',
      'refuz',
      'modificare_oferta',
      'oferta_trimisa',
      'plata_pending',
      'oferta_platita',
      'finalizata'
    )
  );

CREATE INDEX IF NOT EXISTS hp_concierge_crm_stage_updated_idx
  ON public.hp_concierge_crm(stage, updated_at DESC);

NOTIFY pgrst, 'reload schema';
