-- ROLES ----------------------------------------------------------------
CREATE TYPE public.app_role AS ENUM ('admin', 'student');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- LEAGUES --------------------------------------------------------------
CREATE TABLE public.leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  tier int NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.leagues TO authenticated, anon;
GRANT ALL ON public.leagues TO service_role;
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leagues readable" ON public.leagues FOR SELECT USING (true);

INSERT INTO public.leagues (name, tier, slug) VALUES
  ('Bronze', 1, 'bronze'), ('Silver', 2, 'silver'), ('Gold', 3, 'gold'),
  ('Sapphire', 4, 'sapphire'), ('Amethyst', 5, 'amethyst'), ('Diamond', 6, 'diamond');

-- PROFILES -------------------------------------------------------------
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  display_name text,
  bio text,
  avatar_path text,
  avatar_url text,
  xp int NOT NULL DEFAULT 0,
  league_id uuid REFERENCES public.leagues(id) ON DELETE SET NULL,
  hidden_from_rankings boolean NOT NULL DEFAULT false,
  episodes_completed int NOT NULL DEFAULT 0,
  correct_answers int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX profiles_xp_idx ON public.profiles (xp DESC);
CREATE INDEX profiles_league_idx ON public.profiles (league_id);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by students" ON public.profiles FOR SELECT TO authenticated
  USING (hidden_from_rankings = false OR id = auth.uid());
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- SERIES / EPISODES ----------------------------------------------------
CREATE TABLE public.series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  topic text,
  subject text,
  cover_gradient text,
  status text NOT NULL DEFAULT 'ready',
  is_public boolean NOT NULL DEFAULT true,
  episode_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX series_owner_idx ON public.series (owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.series TO authenticated;
GRANT ALL ON public.series TO service_role;
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "series readable" ON public.series FOR SELECT TO authenticated USING (is_public = true OR owner_id = auth.uid());
CREATE POLICY "series insert own" ON public.series FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "series update own" ON public.series FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "series delete own" ON public.series FOR DELETE TO authenticated USING (owner_id = auth.uid());
CREATE TRIGGER series_touch BEFORE UPDATE ON public.series FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_index int NOT NULL DEFAULT 0,
  title text NOT NULL,
  synopsis text,
  duration_seconds int NOT NULL DEFAULT 300,
  video_url text,
  video_job_id text,
  status text NOT NULL DEFAULT 'ready',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (series_id, order_index)
);
CREATE INDEX episodes_series_idx ON public.episodes (series_id, order_index);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.episodes TO authenticated;
GRANT ALL ON public.episodes TO service_role;
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "episodes readable" ON public.episodes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.series s WHERE s.id = series_id AND (s.is_public OR s.owner_id = auth.uid())));
CREATE POLICY "episodes insert own" ON public.episodes FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "episodes update own" ON public.episodes FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "episodes delete own" ON public.episodes FOR DELETE TO authenticated USING (owner_id = auth.uid());
CREATE TRIGGER episodes_touch BEFORE UPDATE ON public.episodes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.episode_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  order_index int NOT NULL DEFAULT 0,
  title text NOT NULL,
  bullets jsonb NOT NULL DEFAULT '[]'::jsonb,
  takeaway text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (episode_id, order_index)
);
CREATE INDEX episode_slides_episode_idx ON public.episode_slides (episode_id, order_index);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.episode_slides TO authenticated;
GRANT ALL ON public.episode_slides TO service_role;
ALTER TABLE public.episode_slides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "slides readable" ON public.episode_slides FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.episodes e JOIN public.series s ON s.id = e.series_id
                 WHERE e.id = episode_id AND (s.is_public OR s.owner_id = auth.uid())));
CREATE POLICY "slides write own" ON public.episode_slides FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.episodes e WHERE e.id = episode_id AND e.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.episodes e WHERE e.id = episode_id AND e.owner_id = auth.uid()));

-- QUIZ QUESTIONS -------------------------------------------------------
CREATE TABLE public.episode_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  order_index int NOT NULL DEFAULT 0,
  prompt text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_index int NOT NULL DEFAULT 0,
  explanation text NOT NULL DEFAULT '',
  seconds int NOT NULL DEFAULT 25,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (episode_id, order_index)
);
CREATE INDEX episode_questions_episode_idx ON public.episode_questions (episode_id, order_index);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.episode_questions TO authenticated;
GRANT ALL ON public.episode_questions TO service_role;
ALTER TABLE public.episode_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "questions readable" ON public.episode_questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.episodes e JOIN public.series s ON s.id = e.series_id
                 WHERE e.id = episode_id AND (s.is_public OR s.owner_id = auth.uid())));
CREATE POLICY "questions write own" ON public.episode_questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.episodes e WHERE e.id = episode_id AND e.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.episodes e WHERE e.id = episode_id AND e.owner_id = auth.uid()));

-- CHARACTERS -----------------------------------------------------------
CREATE TABLE public.characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  role_description text,
  image_urls text[] NOT NULL DEFAULT '{}',
  image_paths text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX characters_owner_idx ON public.characters (owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.characters TO authenticated;
GRANT ALL ON public.characters TO service_role;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "characters own" ON public.characters FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER characters_touch BEFORE UPDATE ON public.characters FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.series_characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (series_id, character_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.series_characters TO authenticated;
GRANT ALL ON public.series_characters TO service_role;
ALTER TABLE public.series_characters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "series characters readable" ON public.series_characters FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.series s WHERE s.id = series_id AND (s.is_public OR s.owner_id = auth.uid())));
CREATE POLICY "series characters write own" ON public.series_characters FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.series s WHERE s.id = series_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.series s WHERE s.id = series_id AND s.owner_id = auth.uid()));

-- STUDY MATERIALS ------------------------------------------------------
CREATE TABLE public.study_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  series_id uuid REFERENCES public.series(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'file',
  file_name text,
  file_path text,
  mime_type text,
  size_bytes bigint,
  text_content text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX study_materials_owner_idx ON public.study_materials (owner_id);
CREATE INDEX study_materials_series_idx ON public.study_materials (series_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_materials TO authenticated;
GRANT ALL ON public.study_materials TO service_role;
ALTER TABLE public.study_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "materials own" ON public.study_materials FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- PROGRESS -------------------------------------------------------------
CREATE TABLE public.progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  episode_id uuid NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  last_slide_index int NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  perfect_quiz boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, episode_id)
);
CREATE INDEX progress_user_series_idx ON public.progress (user_id, series_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress TO authenticated;
GRANT ALL ON public.progress TO service_role;
ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "progress own" ON public.progress FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER progress_touch BEFORE UPDATE ON public.progress FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- QUIZ ATTEMPTS --------------------------------------------------------
CREATE TABLE public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  episode_id uuid REFERENCES public.episodes(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.episode_questions(id) ON DELETE CASCADE,
  question_text text NOT NULL DEFAULT '',
  selected_answer text,
  is_correct boolean NOT NULL DEFAULT false,
  time_taken_ms int,
  timed_out boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quiz_attempts_user_idx ON public.quiz_attempts (user_id, created_at DESC);
CREATE UNIQUE INDEX quiz_attempts_unique_question ON public.quiz_attempts (user_id, question_id) WHERE question_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_attempts TO authenticated;
GRANT ALL ON public.quiz_attempts TO service_role;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attempts own" ON public.quiz_attempts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- XP -------------------------------------------------------------------
CREATE TABLE public.xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  amount int NOT NULL,
  source_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, source_key)
);
CREATE INDEX xp_events_user_idx ON public.xp_events (user_id, created_at DESC);
GRANT SELECT, INSERT ON public.xp_events TO authenticated;
GRANT ALL ON public.xp_events TO service_role;
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "xp own read" ON public.xp_events FOR SELECT TO authenticated USING (user_id = auth.uid());

-- STREAKS --------------------------------------------------------------
CREATE TABLE public.streaks (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak int NOT NULL DEFAULT 0,
  longest_streak int NOT NULL DEFAULT 0,
  last_activity_date date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.streaks TO authenticated;
GRANT ALL ON public.streaks TO service_role;
ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "streaks readable" ON public.streaks FOR SELECT TO authenticated USING (true);

CREATE TABLE public.streak_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, day)
);
CREATE INDEX streak_days_user_idx ON public.streak_days (user_id, day DESC);
GRANT SELECT ON public.streak_days TO authenticated;
GRANT ALL ON public.streak_days TO service_role;
ALTER TABLE public.streak_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "streak days own" ON public.streak_days FOR SELECT TO authenticated USING (user_id = auth.uid());

-- BADGES ---------------------------------------------------------------
CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  emoji text NOT NULL DEFAULT '🏅',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.badges TO authenticated, anon;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "badges readable" ON public.badges FOR SELECT USING (true);

INSERT INTO public.badges (code, name, description, emoji, sort_order) VALUES
  ('bookworm', 'Bookworm', 'Complete 50 episodes', '📖', 1),
  ('quiz_master', 'Quiz Master', 'Answer 100 questions correctly', '🧠', 2),
  ('locked_in', 'Locked In', 'Maintain a 30-day streak', '🔥', 3),
  ('fast_and_furious', 'Fast and Furious', 'Finish 5 episodes in one day', '⚡', 4),
  ('academic_weapon', 'Academic Weapon', 'Reach #1 in the highest league', '👑', 5);

CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  celebrated boolean NOT NULL DEFAULT false,
  UNIQUE (user_id, badge_id)
);
CREATE INDEX user_badges_user_idx ON public.user_badges (user_id);
GRANT SELECT, UPDATE ON public.user_badges TO authenticated;
GRANT ALL ON public.user_badges TO service_role;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user badges readable" ON public.user_badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "user badges celebrate own" ON public.user_badges FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- SEASONS / LEADERBOARD ------------------------------------------------
CREATE TABLE public.league_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.league_seasons TO authenticated;
GRANT ALL ON public.league_seasons TO service_role;
ALTER TABLE public.league_seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seasons readable" ON public.league_seasons FOR SELECT TO authenticated USING (true);
INSERT INTO public.league_seasons (starts_at, ends_at) VALUES (now(), now() + interval '14 days');

CREATE TABLE public.leaderboard_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  xp int NOT NULL DEFAULT 0,
  rank int,
  promoted boolean NOT NULL DEFAULT false,
  demoted boolean NOT NULL DEFAULT false,
  celebrated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season_id, user_id)
);
CREATE INDEX leaderboard_league_idx ON public.leaderboard_entries (season_id, league_id, xp DESC);
GRANT SELECT, UPDATE ON public.leaderboard_entries TO authenticated;
GRANT ALL ON public.leaderboard_entries TO service_role;
ALTER TABLE public.leaderboard_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leaderboard readable" ON public.leaderboard_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "leaderboard celebrate own" ON public.leaderboard_entries FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER leaderboard_touch BEFORE UPDATE ON public.leaderboard_entries FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- CHAT -----------------------------------------------------------------
CREATE TABLE public.chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New chat',
  last_opened_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_threads_user_idx ON public.chat_threads (user_id, last_opened_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_threads TO authenticated;
GRANT ALL ON public.chat_threads TO service_role;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "threads own" ON public.chat_threads FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER chat_threads_touch BEFORE UPDATE ON public.chat_threads FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL DEFAULT '',
  image_urls text[] NOT NULL DEFAULT '{}',
  follow_ups jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_thread_idx ON public.chat_messages (thread_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages own" ON public.chat_messages FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- FLASHCARDS -----------------------------------------------------------
CREATE TABLE public.flashcard_decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  topic text,
  source text NOT NULL DEFAULT 'ai',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX flashcard_decks_owner_idx ON public.flashcard_decks (owner_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcard_decks TO authenticated;
GRANT ALL ON public.flashcard_decks TO service_role;
ALTER TABLE public.flashcard_decks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "decks own" ON public.flashcard_decks FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER decks_touch BEFORE UPDATE ON public.flashcard_decks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.flashcards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id uuid NOT NULL REFERENCES public.flashcard_decks(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  front text NOT NULL,
  back text NOT NULL,
  order_index int NOT NULL DEFAULT 0,
  known boolean NOT NULL DEFAULT false,
  reviews int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX flashcards_deck_idx ON public.flashcards (deck_id, order_index);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcards TO authenticated;
GRANT ALL ON public.flashcards TO service_role;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cards own" ON public.flashcards FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());