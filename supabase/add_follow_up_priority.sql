-- Run in Supabase SQL Editor if follow_ups exists without priority / notes.

ALTER TABLE public.follow_ups
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.follow_ups
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium';

ALTER TABLE public.follow_ups
  DROP CONSTRAINT IF EXISTS follow_ups_priority_check;

ALTER TABLE public.follow_ups
  ADD CONSTRAINT follow_ups_priority_check
  CHECK (priority IN ('high', 'medium', 'low'));

UPDATE public.follow_ups
SET priority = 'medium'
WHERE priority IS NULL OR priority NOT IN ('high', 'medium', 'low');
