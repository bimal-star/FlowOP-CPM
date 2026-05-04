-- FlowOP CRM — run this in the Supabase SQL Editor (one script).
-- Creates enquiry pipeline enum, tables, updated_at triggers, and Row Level Security.

CREATE TABLE public.enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  contact_name text NOT NULL,
  company text,
  email text,
  source text,
  query_summary text,
  stage text NOT NULL DEFAULT 'enquiry',
  next_action text,
  notes text,
  date_received date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX enquiries_user_id_idx ON public.enquiries (user_id);
CREATE INDEX enquiries_stage_idx ON public.enquiries (stage);
CREATE INDEX enquiries_created_at_idx ON public.enquiries (created_at DESC);

CREATE TABLE public.follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  enquiry_id uuid NOT NULL REFERENCES public.enquiries (id) ON DELETE CASCADE,
  contact_name text,
  due_at timestamptz NOT NULL,
  action_text text NOT NULL,
  notes text,
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('high', 'medium', 'low')),
  is_done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX follow_ups_user_id_idx ON public.follow_ups (user_id);
CREATE INDEX follow_ups_enquiry_id_idx ON public.follow_ups (enquiry_id);
CREATE INDEX follow_ups_due_at_idx ON public.follow_ups (due_at);
CREATE INDEX follow_ups_open_idx ON public.follow_ups (user_id, is_done, due_at)
  WHERE is_done = false;

CREATE TABLE public.stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id uuid NOT NULL REFERENCES public.enquiries (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  from_stage text,
  to_stage text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX stage_history_enquiry_id_idx
  ON public.stage_history (enquiry_id, changed_at ASC);

CREATE INDEX stage_history_user_id_idx
  ON public.stage_history (user_id);

-- Keep updated_at in sync
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER enquiries_set_updated_at
  BEFORE UPDATE ON public.enquiries
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

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

CREATE TRIGGER enquiries_log_stage
  AFTER INSERT OR UPDATE ON public.enquiries
  FOR EACH ROW
  EXECUTE PROCEDURE public.log_enquiry_stage_change();

CREATE TRIGGER follow_ups_set_updated_at
  BEFORE UPDATE ON public.follow_ups
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.email_templates (id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  category text,
  sort_order integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_templates_level_check CHECK (level >= 0 AND level <= 2)
);

CREATE INDEX email_templates_user_id_idx ON public.email_templates (user_id);

CREATE TRIGGER email_templates_set_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

CREATE TABLE public.pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  label text NOT NULL,
  colour text NOT NULL DEFAULT '#6b7280',
  sort_order integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pipeline_stages_user_sort_idx
  ON public.pipeline_stages (user_id, sort_order ASC);

CREATE UNIQUE INDEX pipeline_stages_user_id_name_key
  ON public.pipeline_stages (user_id, name);

ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

-- Authenticated users only see and manage their own rows
CREATE POLICY enquiries_select_own ON public.enquiries
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY enquiries_insert_own ON public.enquiries
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY enquiries_update_own ON public.enquiries
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY enquiries_delete_own ON public.enquiries
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY follow_ups_select_own ON public.follow_ups
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY follow_ups_insert_own ON public.follow_ups
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY follow_ups_update_own ON public.follow_ups
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY follow_ups_delete_own ON public.follow_ups
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY stage_history_select_own ON public.stage_history
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY email_templates_select_own ON public.email_templates
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY email_templates_insert_own ON public.email_templates
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY email_templates_update_own ON public.email_templates
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY email_templates_delete_own ON public.email_templates
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY pipeline_stages_select_own ON public.pipeline_stages
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY pipeline_stages_insert_own ON public.pipeline_stages
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY pipeline_stages_update_own ON public.pipeline_stages
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY pipeline_stages_delete_own ON public.pipeline_stages
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.enquiries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_ups TO authenticated;

GRANT SELECT ON public.stage_history TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_stages TO authenticated;
