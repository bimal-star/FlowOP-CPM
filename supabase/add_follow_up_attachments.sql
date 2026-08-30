-- Follow-up file attachments (Phase 1): metadata table + private Storage bucket.
-- Run in Supabase SQL Editor after schema.sql / existing migrations.

CREATE TABLE public.follow_up_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  enquiry_id uuid NOT NULL REFERENCES public.enquiries (id) ON DELETE CASCADE,
  follow_up_id uuid NOT NULL REFERENCES public.follow_ups (id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX follow_up_attachments_user_id_idx
  ON public.follow_up_attachments (user_id);

CREATE INDEX follow_up_attachments_enquiry_id_idx
  ON public.follow_up_attachments (enquiry_id);

CREATE INDEX follow_up_attachments_follow_up_id_idx
  ON public.follow_up_attachments (follow_up_id);

ALTER TABLE public.follow_up_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY follow_up_attachments_select_own ON public.follow_up_attachments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY follow_up_attachments_insert_own ON public.follow_up_attachments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY follow_up_attachments_delete_own ON public.follow_up_attachments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.follow_up_attachments TO authenticated;

-- Private bucket (25 MB per object). MIME allow-list enforced in the app.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('follow-up-files', 'follow-up-files', false, 26214400)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit;

-- Path layout: {user_id}/{enquiry_id}/{follow_up_id}/{attachment_id}-{filename}
CREATE POLICY follow_up_files_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'follow-up-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY follow_up_files_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'follow-up-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY follow_up_files_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'follow-up-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
