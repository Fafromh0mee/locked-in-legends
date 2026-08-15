ALTER TABLE public.episodes
  ADD COLUMN IF NOT EXISTS voice_gender text NOT NULL DEFAULT 'neutral',
  ADD COLUMN IF NOT EXISTS narrator_voice text;

ALTER TABLE public.episode_slides
  ADD COLUMN IF NOT EXISTS narration_text text,
  ADD COLUMN IF NOT EXISTS narration_duration_seconds numeric;

NOTIFY pgrst, 'reload schema';
