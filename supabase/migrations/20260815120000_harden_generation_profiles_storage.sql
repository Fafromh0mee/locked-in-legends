-- Storage buckets used by the app. Policies already restrict object access to
-- each user's first path segment; these rows make the referenced buckets real.
INSERT INTO storage.buckets (id, name, "public", file_size_limit)
VALUES
  ('materials', 'materials', false, 26214400),
  ('characters', 'characters', false, 26214400),
  ('avatars', 'avatars', false, 26214400),
  ('series-covers', 'series-covers', false, 26214400)
ON CONFLICT (id) DO UPDATE
SET "public" = EXCLUDED."public",
    file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "Users can update their own series covers" ON storage.objects;
CREATE POLICY "Users can update their own series covers"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'series-covers' AND (storage.foldername(name))[1] = (select auth.uid())::text)
WITH CHECK (bucket_id = 'series-covers' AND (storage.foldername(name))[1] = (select auth.uid())::text);

ALTER TABLE public.generation_jobs
  ADD COLUMN IF NOT EXISTS input_context jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.xp_events
  ALTER COLUMN source_key DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_uidx
  ON public.profiles (lower(username));

CREATE OR REPLACE FUNCTION public.unique_profile_username(_requested text, _user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _base text;
  _candidate text;
  _suffix text;
  _n integer := 1;
BEGIN
  _base := lower(regexp_replace(coalesce(nullif(trim(_requested), ''), 'student_' || substr(replace(_user_id::text, '-', ''), 1, 8)), '[^a-z0-9._]', '_', 'g'));
  _base := trim(both '._' from _base);
  IF length(_base) < 3 THEN
    _base := 'student_' || substr(replace(_user_id::text, '-', ''), 1, 8);
  END IF;
  _base := left(_base, 24);
  _candidate := _base;

  WHILE EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE lower(p.username) = lower(_candidate)
      AND p.id <> _user_id
  ) LOOP
    _n := _n + 1;
    _suffix := '_' || _n::text;
    _candidate := left(_base, 24 - length(_suffix)) || _suffix;
  END LOOP;

  RETURN _candidate;
END;
$$;

REVOKE ALL ON FUNCTION public.unique_profile_username(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unique_profile_username(text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.unique_profile_username(text, uuid) FROM authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _username text;
  _display text;
BEGIN
  _username := public.unique_profile_username(NEW.raw_user_meta_data ->> 'username', NEW.id);
  _display := nullif(trim(coalesce(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name', _username)), '');

  INSERT INTO public.profiles (id, username, display_name)
  VALUES (NEW.id, _username, _display)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.ensure_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _profile public.profiles%ROWTYPE;
  _requested text;
  _display text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO _profile FROM public.profiles WHERE id = _uid;
  IF FOUND THEN
    RETURN _profile;
  END IF;

  _requested := coalesce(auth.jwt() -> 'user_metadata' ->> 'username', split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1));
  _display := nullif(trim(coalesce(auth.jwt() -> 'user_metadata' ->> 'display_name', auth.jwt() -> 'user_metadata' ->> 'full_name', _requested)), '');

  INSERT INTO public.profiles (id, username, display_name)
  VALUES (_uid, public.unique_profile_username(_requested, _uid), _display)
  RETURNING * INTO _profile;

  RETURN _profile;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_profile() FROM anon;
GRANT EXECUTE ON FUNCTION public.ensure_profile() TO authenticated;

CREATE OR REPLACE FUNCTION public.unlock_badge(_user_id uuid, _code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_badges (user_id, badge_id)
  SELECT _user_id, b.id
  FROM public.badges b
  WHERE b.code = _code
  ON CONFLICT (user_id, badge_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.unlock_badge(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unlock_badge(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.unlock_badge(uuid, text) FROM authenticated;

CREATE OR REPLACE FUNCTION public.sync_profile_badges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.episodes_completed >= 50 THEN
    PERFORM public.unlock_badge(NEW.id, 'bookworm');
  END IF;
  IF NEW.correct_answers >= 100 THEN
    PERFORM public.unlock_badge(NEW.id, 'quiz_master');
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_profile_badges() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_profile_badges() FROM anon;
REVOKE ALL ON FUNCTION public.sync_profile_badges() FROM authenticated;

DROP TRIGGER IF EXISTS profiles_sync_badges ON public.profiles;
CREATE TRIGGER profiles_sync_badges
AFTER INSERT OR UPDATE OF episodes_completed, correct_answers ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_badges();

CREATE OR REPLACE FUNCTION public.sync_streak_badges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.current_streak >= 30 THEN
    PERFORM public.unlock_badge(NEW.user_id, 'locked_in');
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_streak_badges() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_streak_badges() FROM anon;
REVOKE ALL ON FUNCTION public.sync_streak_badges() FROM authenticated;

DROP TRIGGER IF EXISTS streaks_sync_badges ON public.streaks;
CREATE TRIGGER streaks_sync_badges
AFTER INSERT OR UPDATE OF current_streak ON public.streaks
FOR EACH ROW EXECUTE FUNCTION public.sync_streak_badges();

CREATE OR REPLACE FUNCTION public.sync_progress_badges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _completed_today integer;
BEGIN
  IF NEW.completed IS TRUE AND NEW.completed_at IS NOT NULL THEN
    SELECT count(*) INTO _completed_today
    FROM public.progress p
    WHERE p.user_id = NEW.user_id
      AND p.completed IS TRUE
      AND (p.completed_at AT TIME ZONE 'UTC')::date = (NEW.completed_at AT TIME ZONE 'UTC')::date;

    IF _completed_today >= 5 THEN
      PERFORM public.unlock_badge(NEW.user_id, 'fast_and_furious');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_progress_badges() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_progress_badges() FROM anon;
REVOKE ALL ON FUNCTION public.sync_progress_badges() FROM authenticated;

DROP TRIGGER IF EXISTS progress_sync_badges ON public.progress;
CREATE TRIGGER progress_sync_badges
AFTER INSERT OR UPDATE OF completed, completed_at ON public.progress
FOR EACH ROW EXECUTE FUNCTION public.sync_progress_badges();

CREATE OR REPLACE FUNCTION public.sync_leaderboard_badges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.rank = 1 AND EXISTS (
    SELECT 1
    FROM public.leagues l
    WHERE l.id = NEW.league_id
      AND l.tier = (SELECT max(tier) FROM public.leagues)
  ) THEN
    PERFORM public.unlock_badge(NEW.user_id, 'academic_weapon');
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_leaderboard_badges() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_leaderboard_badges() FROM anon;
REVOKE ALL ON FUNCTION public.sync_leaderboard_badges() FROM authenticated;

DROP TRIGGER IF EXISTS leaderboard_sync_badges ON public.leaderboard_entries;
CREATE TRIGGER leaderboard_sync_badges
AFTER INSERT OR UPDATE OF rank ON public.leaderboard_entries
FOR EACH ROW EXECUTE FUNCTION public.sync_leaderboard_badges();

CREATE OR REPLACE FUNCTION public.finalize_expired_league_seasons()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _season record;
  _min_tier integer;
  _max_tier integer;
BEGIN
  SELECT min(tier), max(tier) INTO _min_tier, _max_tier FROM public.leagues;

  FOR _season IN
    SELECT id FROM public.league_seasons WHERE is_active IS TRUE AND ends_at <= now()
  LOOP
    UPDATE public.leaderboard_entries
    SET rank = NULL, promoted = false, demoted = false
    WHERE season_id = _season.id;

    WITH ranked AS (
      SELECT
        le.id,
        row_number() OVER (PARTITION BY le.season_id, le.league_id ORDER BY le.xp DESC, le.updated_at ASC) AS season_rank,
        count(*) OVER (PARTITION BY le.season_id, le.league_id) AS total_count,
        l.tier
      FROM public.leaderboard_entries le
      JOIN public.profiles p ON p.id = le.user_id
      JOIN public.leagues l ON l.id = le.league_id
      WHERE le.season_id = _season.id
        AND p.hidden_from_rankings IS FALSE
    )
    UPDATE public.leaderboard_entries le
    SET rank = ranked.season_rank,
        promoted = ranked.season_rank <= 7 AND ranked.tier < _max_tier,
        demoted = ranked.season_rank > greatest(ranked.total_count - 5, 7) AND ranked.tier > _min_tier,
        updated_at = now()
    FROM ranked
    WHERE ranked.id = le.id;

    UPDATE public.profiles p
    SET league_id = target.id,
        updated_at = now()
    FROM public.leaderboard_entries le
    JOIN public.leagues current_league ON current_league.id = le.league_id
    JOIN public.leagues target ON target.tier = CASE
      WHEN le.promoted THEN current_league.tier + 1
      WHEN le.demoted THEN current_league.tier - 1
      ELSE current_league.tier
    END
    WHERE le.season_id = _season.id
      AND le.user_id = p.id
      AND (le.promoted OR le.demoted);

    UPDATE public.league_seasons
    SET is_active = false
    WHERE id = _season.id;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM public.league_seasons WHERE is_active IS TRUE) THEN
    INSERT INTO public.league_seasons (starts_at, ends_at, is_active)
    VALUES (now(), now() + interval '14 days', true);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_expired_league_seasons() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_expired_league_seasons() FROM anon;
REVOKE ALL ON FUNCTION public.finalize_expired_league_seasons() FROM authenticated;

DROP FUNCTION IF EXISTS public.award_xp(text, integer, text);

CREATE OR REPLACE FUNCTION public.award_xp(_kind text, _amount integer, _source_key text DEFAULT NULL::text)
RETURNS TABLE(awarded integer, total_xp integer, current_streak integer, streak_incremented boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _inserted boolean := false;
  _total integer := 0;
  _streak integer := 0;
  _bumped boolean := false;
  _today date := (now() AT TIME ZONE 'UTC')::date;
  _last date;
  _season uuid;
  _league uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _amount IS NULL OR _amount < 0 OR _amount > 500 THEN RAISE EXCEPTION 'invalid amount'; END IF;

  PERFORM public.ensure_profile();
  PERFORM public.finalize_expired_league_seasons();

  IF _source_key IS NULL THEN
    INSERT INTO public.xp_events (user_id, kind, amount, source_key) VALUES (_uid, _kind, _amount, NULL);
    _inserted := true;
  ELSE
    INSERT INTO public.xp_events (user_id, kind, amount, source_key)
    VALUES (_uid, _kind, _amount, _source_key)
    ON CONFLICT (user_id, source_key) WHERE source_key IS NOT NULL DO NOTHING;
    _inserted := FOUND;
  END IF;

  IF _inserted AND _amount > 0 THEN
    UPDATE public.profiles p
    SET xp = p.xp + _amount,
        updated_at = now()
    WHERE p.id = _uid
    RETURNING p.xp INTO _total;

    SELECT s.id INTO _season
    FROM public.league_seasons s
    WHERE s.is_active
    ORDER BY s.starts_at DESC
    LIMIT 1;

    SELECT p.league_id INTO _league FROM public.profiles p WHERE p.id = _uid;
    IF _season IS NOT NULL AND _league IS NOT NULL THEN
      INSERT INTO public.leaderboard_entries (season_id, user_id, league_id, xp)
      VALUES (_season, _uid, _league, _amount)
      ON CONFLICT (season_id, user_id)
      DO UPDATE SET xp = public.leaderboard_entries.xp + EXCLUDED.xp,
                    updated_at = now();
    END IF;
  ELSE
    SELECT p.xp INTO _total FROM public.profiles p WHERE p.id = _uid;
  END IF;

  INSERT INTO public.streaks (user_id, current_streak, longest_streak, last_activity_date)
  VALUES (_uid, 0, 0, NULL)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT st.last_activity_date INTO _last FROM public.streaks st WHERE st.user_id = _uid;
  IF _last IS DISTINCT FROM _today THEN
    UPDATE public.streaks st
    SET current_streak = CASE WHEN _last = _today - 1 THEN st.current_streak + 1 ELSE 1 END,
        longest_streak = GREATEST(st.longest_streak, CASE WHEN _last = _today - 1 THEN st.current_streak + 1 ELSE 1 END),
        last_activity_date = _today,
        updated_at = now()
    WHERE st.user_id = _uid
    RETURNING st.current_streak INTO _streak;

    INSERT INTO public.streak_days (user_id, day)
    VALUES (_uid, _today)
    ON CONFLICT DO NOTHING;
    _bumped := true;
  ELSE
    SELECT st.current_streak INTO _streak FROM public.streaks st WHERE st.user_id = _uid;
  END IF;

  RETURN QUERY SELECT CASE WHEN _inserted THEN _amount ELSE 0 END, COALESCE(_total, 0), COALESCE(_streak, 0), _bumped;
END;
$$;

REVOKE ALL ON FUNCTION public.award_xp(text, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.award_xp(text, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.award_xp(text, integer, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
