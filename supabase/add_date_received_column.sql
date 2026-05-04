-- Run in Supabase SQL Editor if `enquiries` already exists without `date_received`.
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS date_received date NOT NULL DEFAULT CURRENT_DATE;
