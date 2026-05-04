ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
