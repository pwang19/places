-- App admins: allowlist by email local-part, review delete RLS, profile sync, RPCs.

CREATE TABLE IF NOT EXISTS public.app_admins (
  username text PRIMARY KEY
);

ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.app_admins FROM PUBLIC;
REVOKE ALL ON public.app_admins FROM anon;
REVOKE ALL ON public.app_admins FROM authenticated;

INSERT INTO public.app_admins (username) VALUES ('peter.wang') ON CONFLICT (username) DO NOTHING;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

UPDATE public.profiles p
SET is_admin = EXISTS (
  SELECT 1 FROM public.app_admins a
  WHERE lower(a.username) = lower(split_part(COALESCE(p.email, ''), '@', 1))
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, google_sub, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'sub',
    EXISTS (
      SELECT 1 FROM public.app_admins a
      WHERE lower(a.username) = lower(split_part(COALESCE(NEW.email, ''), '@', 1))
    )
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH u AS (
    SELECT lower(trim(split_part(COALESCE(
      NULLIF(trim(auth.jwt() ->> 'email'), ''),
      (SELECT u2.email FROM auth.users u2 WHERE u2.id = auth.uid())
    ), '@', 1))) AS local_part
  )
  SELECT EXISTS (
    SELECT 1 FROM public.app_admins a, u
    WHERE COALESCE(u.local_part, '') <> ''
      AND lower(a.username) = u.local_part
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_app_admin();
$$;

CREATE OR REPLACE FUNCTION public.get_app_admins()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(
    (SELECT jsonb_agg(username ORDER BY username) FROM public.app_admins),
    '[]'::jsonb
  );
END;
$$;

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

  DELETE FROM public.app_admins;
  INSERT INTO public.app_admins (username)
  SELECT unnest(cleaned);

  UPDATE public.profiles p
  SET is_admin = EXISTS (
    SELECT 1 FROM public.app_admins a
    WHERE lower(a.username) = lower(split_part(COALESCE(p.email, ''), '@', 1))
  );
END;
$$;

DROP POLICY IF EXISTS "reviews_delete_when_admin" ON public.reviews;
CREATE POLICY "reviews_delete_when_admin"
  ON public.reviews FOR DELETE TO authenticated
  USING (public.is_app_admin());

GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_app_admins() TO authenticated;
GRANT EXECUTE ON FUNCTION public.replace_app_admins(text[]) TO authenticated;
