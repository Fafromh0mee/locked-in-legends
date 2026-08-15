ALTER TABLE public.series ADD COLUMN IF NOT EXISTS cover_url text;

CREATE POLICY "Signed-in users can view series covers"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'series-covers');

CREATE POLICY "Users can upload their own series covers"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'series-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their own series covers"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'series-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own series covers"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'series-covers' AND (storage.foldername(name))[1] = auth.uid()::text);