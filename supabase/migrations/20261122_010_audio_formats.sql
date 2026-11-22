-- Restore original IceDeck upload formats while keeping each team's Storage private.
-- Requires initial schema, 004 MP3 upload, and the existing team RLS helpers.
BEGIN;
DO $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'icedeck_team_supported_media_upload'
 ) THEN
  CREATE POLICY icedeck_team_supported_media_upload
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'icedeck-audio'
    AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](mp3|m4a|mp4|wav|ogg)$'
    AND EXISTS (
      SELECT 1 FROM public.songs AS s
      WHERE s.storage_path = name
        AND s.scope = 'team'
        AND s.team_id::text = (storage.foldername(name))[1]
        AND public.can_edit_team(s.team_id)
    )
  );
 END IF;
END $$;
COMMIT;
