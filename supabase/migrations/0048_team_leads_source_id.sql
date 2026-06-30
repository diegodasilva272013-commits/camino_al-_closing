-- Vincula cada team_lead con el lead original de public.leads
-- UNIQUE garantiza que un lead del pool jamás se distribuye dos veces
ALTER TABLE public.team_leads
  ADD COLUMN IF NOT EXISTS source_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS team_leads_source_lead_id_uniq
  ON public.team_leads(source_lead_id)
  WHERE source_lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS team_leads_source_lead_id_idx ON public.team_leads(source_lead_id);
