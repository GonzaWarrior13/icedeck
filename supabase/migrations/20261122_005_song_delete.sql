-- IceDeck migration: delete team-owned songs and private MP3s.
-- Only authenticated owner/admin/dj members can delete files in their team.
-- For Storage cleanup after song-row deletion, SELECT and DELETE need to
-- authorize by the team folder, not the now-deleted songs row.
BEGIN;
GRANT DELETE ON TABLE public.songs TO authenticated;

DO $policies$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='icedeck_editor_audio_cleanup_read'
  ) THEN
    CREATE POLICY icedeck_editor_audio_cleanup_read
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'icedeck-audio'
      AND array_length(storage.foldername(name), 1) = 1
      AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND public.can_edit_team(((storage.foldername(name))[1])::uuid)
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='icedeck_editor_audio_delete'
  ) THEN
    CREATE POLICY icedeck_editor_audio_delete
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'icedeck-audio'
      AND array_length(storage.foldername(name), 1) = 1
      AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND public.can_edit_team(((storage.foldername(name))[1])::uuid)
    );
  END IF;
END;
$policies$;
COMMIT;
