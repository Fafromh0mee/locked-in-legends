REVOKE ALL ON FUNCTION public.award_xp(text, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.award_xp(text, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.award_xp(text, integer, text) TO authenticated;