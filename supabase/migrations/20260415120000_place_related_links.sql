-- Undirected place-to-place links (one row per pair: place_a < place_b).

CREATE TABLE IF NOT EXISTS public.place_related_links (
  place_a bigint NOT NULL REFERENCES public.places (id) ON DELETE CASCADE,
  place_b bigint NOT NULL REFERENCES public.places (id) ON DELETE CASCADE,
  CONSTRAINT place_related_links_ordered CHECK (place_a < place_b),
  CONSTRAINT place_related_links_pkey PRIMARY KEY (place_a, place_b)
);

CREATE INDEX IF NOT EXISTS idx_place_related_links_place_a ON public.place_related_links (place_a);
CREATE INDEX IF NOT EXISTS idx_place_related_links_place_b ON public.place_related_links (place_b);

ALTER TABLE public.place_related_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "place_related_links_select_authenticated"
  ON public.place_related_links FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "place_related_links_insert_authenticated"
  ON public.place_related_links FOR INSERT TO authenticated
  WITH CHECK (
    place_a < place_b
    AND EXISTS (SELECT 1 FROM public.places p1 WHERE p1.id = place_a)
    AND EXISTS (SELECT 1 FROM public.places p2 WHERE p2.id = place_b)
  );

CREATE POLICY "place_related_links_delete_authenticated"
  ON public.place_related_links FOR DELETE TO authenticated
  USING (true);

GRANT SELECT, INSERT, DELETE ON public.place_related_links TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: link_places (normalized pair)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_places(p_place_id bigint, p_related_place_id bigint)
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

  IF p_place_id IS NULL OR p_related_place_id IS NULL THEN
    RAISE EXCEPTION 'place ids are required' USING ERRCODE = '22000';
  END IF;

  IF p_place_id = p_related_place_id THEN
    RAISE EXCEPTION 'cannot link a place to itself' USING ERRCODE = '22000';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.places WHERE id = p_place_id) THEN
    RAISE EXCEPTION 'place not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.places WHERE id = p_related_place_id) THEN
    RAISE EXCEPTION 'related place not found' USING ERRCODE = 'P0002';
  END IF;

  a := LEAST(p_place_id, p_related_place_id);
  b := GREATEST(p_place_id, p_related_place_id);

  INSERT INTO public.place_related_links (place_a, place_b)
  VALUES (a, b)
  ON CONFLICT (place_a, place_b) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_places(bigint, bigint) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: unlink_places
-- ---------------------------------------------------------------------------
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

GRANT EXECUTE ON FUNCTION public.unlink_places(bigint, bigint) TO authenticated;

-- ---------------------------------------------------------------------------
-- get_place_detail: include related_places on place_json
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
    'flag_count', flag_count,
    'related_places', COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'id', op.id,
            'name', op.name,
            'location', op.location,
            'price_range', op.price_range,
            'reviews_disabled', op.reviews_disabled,
            'count', CASE WHEN op.reviews_disabled THEN NULL ELSE rv.cnt END,
            'average_rating', CASE WHEN op.reviews_disabled THEN NULL ELSE rv.avg_r END
          )
          ORDER BY op.name
        )
        FROM place_related_links prl
        JOIN places op ON op.id = CASE
          WHEN prl.place_a = pl.id THEN prl.place_b
          ELSE prl.place_a
        END
        LEFT JOIN (
          SELECT place_id, COUNT(*)::int AS cnt, TRUNC(AVG(rating), 1) AS avg_r
          FROM reviews
          GROUP BY place_id
        ) rv ON rv.place_id = op.id
        WHERE prl.place_a = pl.id OR prl.place_b = pl.id
      ),
      '[]'::json
    )
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
