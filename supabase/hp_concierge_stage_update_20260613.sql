-- HomePitch Analytics: update Concierge CRM stage pipeline.
-- Ruleaza in Supabase analytics (rstihjcnuazzyksdwczp) daca tabela hp_concierge_crm exista deja.

UPDATE public.hp_concierge_crm
SET stage = CASE stage
  WHEN 'new' THEN 'nou'
  WHEN 'contactare' THEN 'contactat'
  WHEN 'consultanta' THEN 'discutie_consultanta'
  WHEN 'oferta_finala' THEN 'oferta_trimisa'
  WHEN 'plata_trimis' THEN 'plata_pending'
  WHEN 'platit' THEN 'oferta_platita'
  WHEN 'livrare' THEN 'oferta_platita'
  WHEN 'inchis' THEN 'oferta_platita'
  WHEN 'pierdut' THEN 'refuz'
  ELSE stage
END
WHERE stage IN ('new','contactare','consultanta','oferta_finala','plata_trimis','platit','livrare','inchis','pierdut');

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
      'oferta_platita',
      'plata_pending'
    )
  );
