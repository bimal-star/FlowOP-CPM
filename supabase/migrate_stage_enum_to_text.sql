-- Run once in Supabase SQL Editor if `enquiries.stage` and `stage_history` still use
-- `enquiry_stage` enum. Required for custom `pipeline_stages` names.
-- The app stores `enquiries.stage` and history values as the `pipeline_stages.name` string.

ALTER TABLE public.stage_history
  ALTER COLUMN from_stage TYPE text USING from_stage::text,
  ALTER COLUMN to_stage TYPE text USING to_stage::text;

ALTER TABLE public.enquiries
  ALTER COLUMN stage TYPE text USING stage::text;

ALTER TABLE public.enquiries
  ALTER COLUMN stage SET DEFAULT 'enquiry';

-- Optional: later drop type public.enquiry_stage if nothing references it.
-- DROP TYPE public.enquiry_stage;
