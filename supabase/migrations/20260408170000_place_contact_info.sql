-- Optional contact fields on places: phone, multiple emails, multiple websites.

ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS emails text[],
  ADD COLUMN IF NOT EXISTS websites text[];

-- ---------------------------------------------------------------------------
-- RPC: list_places (include contact columns)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_places(
  tag_filters text[] DEFAULT NULL,
  list_filters bigint[] DEFAULT NULL
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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
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
          ) AS tags
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
        ORDER BY p.id
      ) s
    ),
    '[]'::jsonb
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: get_place_detail (include contact columns)
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
    'public_list_count', public_list_count
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
        ORDER BY r.id DESC
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
