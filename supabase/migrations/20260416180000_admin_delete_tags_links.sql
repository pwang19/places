-- Wiki model: any authenticated user may add tag links and related-place links.
-- Only app admins may remove tag links (place_tags) or related links (place_related_links).
-- unlink_places is SECURITY DEFINER and bypasses RLS; enforce admin inside the function.

DROP POLICY IF EXISTS "place_tags_authenticated_all" ON public.place_tags;

CREATE POLICY "place_tags_select_authenticated"
  ON public.place_tags FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "place_tags_insert_authenticated"
  ON public.place_tags FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "place_tags_delete_admin"
  ON public.place_tags FOR DELETE TO authenticated
  USING (public.is_app_admin());

DROP POLICY IF EXISTS "place_related_links_delete_authenticated" ON public.place_related_links;

CREATE POLICY "place_related_links_delete_admin"
  ON public.place_related_links FOR DELETE TO authenticated
  USING (public.is_app_admin());

CREATE OR REPLACE FUNCTION public.unlink_places(p_place_id bigint, p_related_place_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a bigint;
  b bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  IF p_place_id IS NULL OR p_related_place_id IS NULL THEN
    RAISE EXCEPTION 'place ids are required' USING ERRCODE = '22000';
  END IF;

  IF p_place_id = p_related_place_id THEN
    RAISE EXCEPTION 'cannot unlink a place from itself' USING ERRCODE = '22000';
  END IF;

  a := LEAST(p_place_id, p_related_place_id);
  b := GREATEST(p_place_id, p_related_place_id);

  DELETE FROM public.place_related_links
  WHERE place_a = a AND place_b = b;
END;
$$;
