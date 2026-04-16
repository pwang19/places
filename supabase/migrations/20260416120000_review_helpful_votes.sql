-- Helpful / unhelpful votes on reviews (one vote per user per review; not on own review).

CREATE TABLE IF NOT EXISTS public.review_votes (
  review_id bigint NOT NULL REFERENCES public.reviews (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  vote smallint NOT NULL CHECK (vote IN (1, -1)),
  PRIMARY KEY (review_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_review_votes_review_id ON public.review_votes (review_id);

ALTER TABLE public.review_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_votes_select_visible_reviews"
  ON public.review_votes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.reviews r
      JOIN public.places p ON p.id = r.place_id
      WHERE r.id = review_votes.review_id
        AND p.reviews_disabled = false
    )
  );

CREATE POLICY "review_votes_insert_not_own_review"
  ON public.review_votes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND vote IN (1, -1)
    AND EXISTS (
      SELECT 1
      FROM public.reviews r
      JOIN public.places p ON p.id = r.place_id
      WHERE r.id = review_votes.review_id
        AND p.reviews_disabled = false
        AND r.user_id IS DISTINCT FROM auth.uid()
    )
  );

CREATE POLICY "review_votes_update_own_not_own_review"
  ON public.review_votes FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND vote IN (1, -1)
    AND EXISTS (
      SELECT 1
      FROM public.reviews r
      JOIN public.places p ON p.id = r.place_id
      WHERE r.id = review_votes.review_id
        AND p.reviews_disabled = false
        AND r.user_id IS DISTINCT FROM auth.uid()
    )
  );

CREATE POLICY "review_votes_delete_own"
  ON public.review_votes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_votes TO authenticated;

-- ---------------------------------------------------------------------------
-- get_place_detail: per-review vote counts + current user's vote
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
          'owned_by_me', (r.user_id IS NOT DISTINCT FROM uid),
          'upvotes', COALESCE(vt.up_cnt, 0),
          'downvotes', COALESCE(vt.down_cnt, 0),
          'vote_total', COALESCE(vt.up_cnt, 0) - COALESCE(vt.down_cnt, 0),
          'my_vote', mv.vote
        )
        ORDER BY (r.user_id IS NOT DISTINCT FROM uid) DESC, r.id DESC
      ),
      '[]'::jsonb
    )
    INTO reviews_json
    FROM reviews r
    LEFT JOIN (
      SELECT
        review_id,
        COUNT(*) FILTER (WHERE vote = 1)::int AS up_cnt,
        COUNT(*) FILTER (WHERE vote = -1)::int AS down_cnt
      FROM review_votes
      GROUP BY review_id
    ) vt ON vt.review_id = r.id
    LEFT JOIN review_votes mv ON mv.review_id = r.id AND mv.user_id IS NOT DISTINCT FROM uid
    WHERE r.place_id = p_place_id;
  END IF;

  RETURN jsonb_build_object(
    'place', place_json,
    'reviews', reviews_json
  );
END;
$$;
