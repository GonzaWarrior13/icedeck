-- IceDeck private MP3 upload permissions
-- Apply to the existing Supabase project. Does not affect Base44.
BEGIN;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON TABLE public.songs TO authenticated;
GRANT INSERT (
  team_id, scope, legacy_id, title, artist, source, storage_path,
  duration, start_point, volume, tags, loudness_db
) ON TABLE public.songs TO authenticated;

-- This policy creates access only if the authenticated user can edit the
-- team's existing songs row. Storage paths must match team/legacyId.mp3.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'icedeck_team_audio_upload'
  ) THEN
    CREATE POLICY icedeck_team_audio_upload
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'icedeck-audio'
      AND array_length(storage.foldername(name), 1) = 1
      AND EXISTS (
        SELECT 1 FROM public.songs s
        WHERE s.scope = 'team'
          AND s.team_id::text = (storage.foldername(name))[1]
          AND name = s.team_id::text || '/' || s.legacy_id || '.mp3'
          AND public.can_edit_team(s.team_id)
      )
    );
  END IF;
END $$;
COMMIT;
