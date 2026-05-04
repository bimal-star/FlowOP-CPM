-- Run in Supabase SQL Editor (existing projects with enquiry_stage_history).
-- Adds stage_history with from_stage → to_stage audit rows and switches the trigger.

CREATE TABLE IF NOT EXISTS public.stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id uuid NOT NULL REFERENCES public.enquiries (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  from_stage public.enquiry_stage,
  to_stage public.enquiry_stage NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stage_history_enquiry_id_idx
  ON public.stage_history (enquiry_id, changed_at ASC);

CREATE INDEX IF NOT EXISTS stage_history_user_id_idx
  ON public.stage_history (user_id);

ALTER TABLE public.stage_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stage_history_select_own ON public.stage_history;
CREATE POLICY stage_history_select_own ON public.stage_history
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON public.stage_history TO authenticated;

-- One-time backfill from legacy enquiry_stage_history (ordered snapshots → transitions)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'enquiry_stage_history')
     AND NOT EXISTS (SELECT 1 FROM public.stage_history LIMIT 1)
     AND EXISTS (SELECT 1 FROM public.enquiry_stage_history LIMIT 1) THEN
    INSERT INTO public.stage_history (enquiry_id, user_id, from_stage, to_stage, changed_at)
    SELECT
      enquiry_id,
      user_id,
      LAG(stage) OVER (PARTITION BY enquiry_id ORDER BY recorded_at),
      stage,
      recorded_at
    FROM public.enquiry_stage_history;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.log_enquiry_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.stage_history (enquiry_id, user_id, from_stage, to_stage, changed_at)
    VALUES (NEW.id, NEW.user_id, NULL, NEW.stage, now());
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND (OLD.stage IS DISTINCT FROM NEW.stage) THEN
    INSERT INTO public.stage_history (enquiry_id, user_id, from_stage, to_stage, changed_at)
    VALUES (NEW.id, NEW.user_id, OLD.stage, NEW.stage, now());
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
