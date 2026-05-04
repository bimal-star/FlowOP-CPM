ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.email_templates (id) ON DELETE CASCADE;

ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 0;

ALTER TABLE public.email_templates
  DROP CONSTRAINT IF EXISTS email_templates_level_check;

ALTER TABLE public.email_templates
  ADD CONSTRAINT email_templates_level_check CHECK (level >= 0 AND level <= 2);
