-- Run in Supabase SQL Editor (existing projects). Idempotent where possible.

CREATE TABLE IF NOT EXISTS public.enquiry_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id uuid NOT NULL REFERENCES public.enquiries (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  stage public.enquiry_stage NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enquiry_stage_history_enquiry_id_idx
  ON public.enquiry_stage_history (enquiry_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS enquiry_stage_history_user_id_idx
  ON public.enquiry_stage_history (user_id);

ALTER TABLE public.enquiry_stage_history ENABLE ROW LEVEL SECURITY;

-- Read own rows (writes are done by trigger only)
DROP POLICY IF EXISTS enquiry_stage_history_select_own ON public.enquiry_stage_history;
CREATE POLICY enquiry_stage_history_select_own ON public.enquiry_stage_history
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON public.enquiry_stage_history TO authenticated;

-- One history row per existing enquiry (initial stage)
INSERT INTO public.enquiry_stage_history (enquiry_id, user_id, stage, recorded_at)
SELECT e.id, e.user_id, e.stage, e.created_at
FROM public.enquiries e
WHERE NOT EXISTS (
  SELECT 1 FROM public.enquiry_stage_history h WHERE h.enquiry_id = e.id
);

CREATE OR REPLACE FUNCTION public.log_enquiry_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.enquiry_stage_history (enquiry_id, user_id, stage, recorded_at)
    VALUES (NEW.id, NEW.user_id, NEW.stage, now());
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND (OLD.stage IS DISTINCT FROM NEW.stage) THEN
    INSERT INTO public.enquiry_stage_history (enquiry_id, user_id, stage, recorded_at)
    VALUES (NEW.id, NEW.user_id, NEW.stage, now());
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enquiries_log_stage ON public.enquiries;
CREATE TRIGGER enquiries_log_stage
  AFTER INSERT OR UPDATE ON public.enquiries
  FOR EACH ROW
  EXECUTE PROCEDURE public.log_enquiry_stage_change();
