CREATE OR REPLACE FUNCTION public.default_league_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.leagues ORDER BY tier LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.default_league_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.default_league_id() FROM anon;

ALTER TABLE public.profiles ALTER COLUMN league_id SET DEFAULT public.default_league_id();
UPDATE public.profiles SET league_id = public.default_league_id() WHERE league_id IS NULL;

NOTIFY pgrst, 'reload schema';