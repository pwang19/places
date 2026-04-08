-- Extend list_places with optional list membership filter (OR across list IDs).
-- Only lists visible to the caller (owner or public) are honored.

DROP FUNCTION IF EXISTS public.list_places(text[]);

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

GRANT EXECUTE ON FUNCTION public.list_places(text[], bigint[]) TO authenticated;
