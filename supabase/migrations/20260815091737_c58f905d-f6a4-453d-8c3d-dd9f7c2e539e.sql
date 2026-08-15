ALTER TABLE public.profiles ALTER COLUMN league_id DROP DEFAULT;
DROP FUNCTION IF EXISTS public.default_league_id();

CREATE OR REPLACE FUNCTION public.set_default_league()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.league_id IS NULL THEN
    SELECT id INTO NEW.league_id FROM public.leagues ORDER BY tier LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_default_league() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_default_league() FROM anon;
REVOKE ALL ON FUNCTION public.set_default_league() FROM authenticated;

DROP TRIGGER IF EXISTS profiles_set_default_league ON public.profiles;
CREATE TRIGGER profiles_set_default_league
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_default_league();