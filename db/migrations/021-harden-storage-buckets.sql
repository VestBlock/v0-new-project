-- Keep private financial documents out of public Supabase Storage URLs.
-- Run after restoring legacy VestBlock database backups.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'credit-reports',
    'credit-reports',
    false,
    26214400,
    ARRAY['application/pdf', 'text/plain']::text[]
  ),
  (
    'dispute-letters',
    'dispute-letters',
    false,
    10485760,
    ARRAY['application/pdf']::text[]
  ),
  (
    'grant-letters',
    'grant-letters',
    false,
    10485760,
    ARRAY['application/pdf']::text[]
  ),
  (
    'biz-roadmaps',
    'biz-roadmaps',
    false,
    10485760,
    ARRAY['application/pdf']::text[]
  )
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Users can upload to their folder in credit-reports" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their files in credit-reports" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their files in credit-reports" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their files in credit-reports" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to dispute-letters" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their dispute-letters" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their dispute-letters" ON storage.objects;

CREATE POLICY "Users can upload to their folder in credit-reports"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'credit-reports'
  AND auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Users can view their files in credit-reports"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'credit-reports'
  AND auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Users can update their files in credit-reports"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'credit-reports'
  AND auth.uid()::text = split_part(name, '/', 1)
)
WITH CHECK (
  bucket_id = 'credit-reports'
  AND auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Users can delete their files in credit-reports"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'credit-reports'
  AND auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Users can upload to dispute-letters"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'dispute-letters'
  AND auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Users can view their dispute-letters"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'dispute-letters'
  AND auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Users can update their dispute-letters"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'dispute-letters'
  AND auth.uid()::text = split_part(name, '/', 1)
)
WITH CHECK (
  bucket_id = 'dispute-letters'
  AND auth.uid()::text = split_part(name, '/', 1)
);
