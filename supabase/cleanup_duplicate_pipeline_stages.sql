-- Run once in Supabase SQL Editor: remove duplicate stage rows (same user + name),
-- then enforce uniqueness so the app only ever has one row per (user, stage name).

DELETE FROM public.pipeline_stages
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, name) id
  FROM public.pipeline_stages
  ORDER BY user_id, name, created_at ASC
);

CREATE UNIQUE INDEX IF NOT EXISTS pipeline_stages_user_id_name_key
  ON public.pipeline_stages (user_id, name);
