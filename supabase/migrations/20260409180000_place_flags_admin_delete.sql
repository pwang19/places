-- Place flags (user reports) and admin-only place deletion.

-- ---------------------------------------------------------------------------
-- place_flags
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.place_flags (
  id bigserial PRIMARY KEY,
  place_id bigint NOT NULL REFERENCES public.places (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT place_flags_reason_nonempty CHECK (length(trim(reason)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_place_flags_place_id ON public.place_flags (place_id);

ALTER TABLE public.place_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "place_flags_select_authenticated"
  ON public.place_flags FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "place_flags_insert_own"
  ON public.place_flags FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.places pl WHERE pl.id = place_id)
  );

CREATE POLICY "place_flags_delete_admin"
  ON public.place_flags FOR DELETE TO authenticated
  USING (public.is_app_admin());

GRANT ALL ON public.place_flags TO authenticated;

-- ---------------------------------------------------------------------------
-- places: admin-only DELETE
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "places_authenticated_all" ON public.places;

CREATE POLICY "places_select_authenticated"
  ON public.places FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "places_insert_authenticated"
  ON public.places FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "places_update_authenticated"
  ON public.places FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "places_delete_admin"
  ON public.places FOR DELETE TO authenticated
  USING (public.is_app_admin());

-- ---------------------------------------------------------------------------
-- RPCs: flagging
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_place_flag(p_place_id bigint, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trimmed text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  trimmed := trim(p_reason);
  IF trimmed = '' THEN
    RAISE EXCEPTION 'reason is required' USING ERRCODE = '22000';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.places WHERE id = p_place_id) THEN
    RAISE EXCEPTION 'place not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.place_flags (place_id, user_id, reason)
  VALUES (p_place_id, auth.uid(), trimmed);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_place_flags(p_place_id bigint)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', f.id,
          'reason', f.reason,
          'created_at', f.created_at,
          'flagged_by',
          COALESCE(
            NULLIF(trim(pr.full_name), ''),
            NULLIF(split_part(COALESCE(pr.email, ''), '@', 1), ''),
            'Someone'
          )
        )
        ORDER BY f.created_at ASC
      )
      FROM public.place_flags f
      LEFT JOIN public.profiles pr ON pr.id = f.user_id
      WHERE f.place_id = p_place_id
    ),
    '[]'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION public.dismiss_place_flags(p_place_id bigint)
RETURNS void
LANGUAGE plpgsql
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
  IF NOT EXISTS (SELECT 1 FROM public.places WHERE id = p_place_id) THEN
    RAISE EXCEPTION 'place not found' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.place_flags WHERE place_id = p_place_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_place_flag(bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_place_flags(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dismiss_place_flags(bigint) TO authenticated;

-- ---------------------------------------------------------------------------
-- list_places: flag_count, optional flagged-only filter (admins only)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.list_places(text[], bigint[]);

CREATE OR REPLACE FUNCTION public.list_places(
  tag_filters text[] DEFAULT NULL,
  list_filters bigint[] DEFAULT NULL,
  p_flagged_only boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  filters text[];
  lists bigint[];
  flagged_only boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  flagged_only := COALESCE(p_flagged_only, false);
  IF flagged_only AND NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  filters := COALESCE(tag_filters, ARRAY[]::text[]);
  lists := COALESCE(list_filters, ARRAY[]::bigint[]);

  RETURN COALESCE(
    (
      SELECT jsonb_agg(row_to_json(s)::jsonb ORDER BY s.id)
      FROM (
        SELECT
          p.id,
          p.name,
          p.location,
          p.phone,
          p.emails,
          p.websites,
          p.price_range,
          p.notes,
          p.reviews_disabled,
          CASE WHEN p.reviews_disabled THEN NULL ELSE rv.count END AS count,
          CASE WHEN p.reviews_disabled THEN NULL ELSE rv.average_rating END AS average_rating,
          COALESCE(
            (
              SELECT json_agg(json_build_object('id', t.id, 'name', t.name) ORDER BY t.name)
              FROM place_tags pt
              JOIN tags t ON t.id = pt.tag_id
              WHERE pt.place_id = p.id
            ),
            '[]'::json
          ) AS tags,
          (SELECT COUNT(*)::int FROM public.place_flags pf WHERE pf.place_id = p.id) AS flag_count
        FROM places p
        LEFT JOIN (
          SELECT place_id, COUNT(*)::int AS count, TRUNC(AVG(rating), 1) AS average_rating
          FROM reviews
          GROUP BY place_id
        ) rv ON p.id = rv.place_id
        WHERE
          (
            cardinality(filters) = 0
            OR NOT EXISTS (
              SELECT 1
              FROM unnest(filters) AS fn(needle)
              WHERE trim(fn.needle) <> ''
                AND NOT EXISTS (
                  SELECT 1
                  FROM place_tags ptf
                  JOIN tags tf ON tf.id = ptf.tag_id
                  WHERE ptf.place_id = p.id
                    AND tf.name ILIKE '%' || trim(fn.needle) || '%'
                )
            )
          )
          AND (
            cardinality(lists) = 0
            OR EXISTS (
              SELECT 1
              FROM place_list_items pli
              JOIN place_lists pl ON pl.id = pli.list_id
              WHERE pli.place_id = p.id
                AND pli.list_id = ANY(lists)
                AND (pl.user_id = auth.uid() OR pl.is_public)
            )
          )
          AND (
            NOT flagged_only
            OR EXISTS (SELECT 1 FROM public.place_flags pff WHERE pff.place_id = p.id)
          )
        ORDER BY p.id
      ) s
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_places(text[], bigint[], boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- get_place_detail: flag_count on place
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_place_detail(p_place_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pl places%ROWTYPE;
  rv_count int;
  rv_avg numeric;
  public_list_count int;
  flag_count int;
  place_json jsonb;
  reviews_json jsonb;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO pl FROM places WHERE id = p_place_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*)::int INTO flag_count
  FROM public.place_flags
  WHERE place_id = p_place_id;

  IF NOT pl.reviews_disabled THEN
    SELECT COUNT(*)::int, TRUNC(AVG(rating), 1)
    INTO rv_count, rv_avg
    FROM reviews
    WHERE place_id = p_place_id;
  ELSE
    rv_count := NULL;
    rv_avg := NULL;
  END IF;

  SELECT COUNT(DISTINCT pli.list_id)::int
  INTO public_list_count
  FROM place_list_items pli
  JOIN place_lists plst ON plst.id = pli.list_id
  WHERE pli.place_id = p_place_id AND plst.is_public IS TRUE;

  place_json := jsonb_build_object(
    'id', pl.id,
    'name', pl.name,
    'location', pl.location,
    'phone', pl.phone,
    'emails', to_jsonb(pl.emails),
    'websites', to_jsonb(pl.websites),
    'price_range', pl.price_range,
    'notes', pl.notes,
    'reviews_disabled', pl.reviews_disabled,
    'count', rv_count,
    'average_rating', rv_avg,
    'tags', COALESCE(
      (
        SELECT json_agg(json_build_object('id', t.id, 'name', t.name) ORDER BY t.name)
        FROM place_tags pt
        JOIN tags t ON t.id = pt.tag_id
        WHERE pt.place_id = pl.id
      ),
      '[]'::json
    ),
    'private_note', NULL::text,
    'public_list_count', public_list_count,
    'flag_count', flag_count
  );

  IF pl.reviews_disabled THEN
    reviews_json := '[]'::jsonb;
  ELSE
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'place_id', r.place_id,
          'name', r.name,
          'review', r.review,
          'rating', r.rating,
          'owned_by_me', (r.user_id IS NOT DISTINCT FROM uid)
        )
        ORDER BY (r.user_id IS NOT DISTINCT FROM uid) DESC, r.id DESC
      ),
      '[]'::jsonb
    )
    INTO reviews_json
    FROM reviews r
    WHERE r.place_id = p_place_id;
  END IF;

  RETURN jsonb_build_object(
    'place', place_json,
    'reviews', reviews_json
  );
END;
$$;
