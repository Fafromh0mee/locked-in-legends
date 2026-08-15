ALTER TABLE public.episode_questions
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'mcq',
  ADD COLUMN IF NOT EXISTS answer_text text;

ALTER TABLE public.episode_questions
  ALTER COLUMN correct_index DROP NOT NULL;

ALTER TABLE public.study_materials
  ADD COLUMN IF NOT EXISTS source_url text;

CREATE TABLE IF NOT EXISTS public.generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  series_id uuid REFERENCES public.series(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued',
  stage text NOT NULL DEFAULT 'Warming up the projector',
  progress integer NOT NULL DEFAULT 0,
  episode_titles jsonb NOT NULL DEFAULT '[]'::jsonb,
  episodes_done integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.generation_jobs TO authenticated;
GRANT ALL ON public.generation_jobs TO service_role;

ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students manage their own generation jobs" ON public.generation_jobs;
CREATE POLICY "Students manage their own generation jobs" ON public.generation_jobs
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS generation_jobs_owner_idx ON public.generation_jobs(owner_id, created_at DESC);