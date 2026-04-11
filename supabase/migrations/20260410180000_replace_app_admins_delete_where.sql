-- Supabase (and some Postgres configs) reject DELETE without a WHERE clause.
-- replace_app_admins must still clear the table before inserting the new list.

CREATE OR REPLACE FUNCTION public.replace_app_admins(p_usernames text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cleaned text[] := ARRAY[]::text[];
  x text;
  y text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  FOREACH x IN ARRAY COALESCE(p_usernames, ARRAY[]::text[])
  LOOP
    y := lower(trim(x));
    IF y = '' OR position('@' IN y) > 0 THEN
      CONTINUE;
    END IF;
    IF NOT (y = ANY(cleaned)) THEN
      cleaned := array_append(cleaned, y);
    END IF;
  END LOOP;

  IF cardinality(cleaned) < 1 THEN
    RAISE EXCEPTION 'at least one admin is required' USING ERRCODE = '22000';
  END IF;

  DELETE FROM public.app_admins WHERE true;
  INSERT INTO public.app_admins (username)
  SELECT unnest(cleaned);

  UPDATE public.profiles p
  SET is_admin = EXISTS (
    SELECT 1 FROM public.app_admins a
    WHERE lower(a.username) = lower(split_part(COALESCE(p.email, ''), '@', 1))
  );
END;
$$;
