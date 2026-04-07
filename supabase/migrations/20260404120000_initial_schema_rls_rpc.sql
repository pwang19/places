-- Places app: schema, profiles, RLS, and RPCs for Supabase + PostgREST.
-- Run via Supabase CLI (`supabase db push`) or SQL Editor after linking a project.

-- ---------------------------------------------------------------------------
-- Profiles (links auth.users to app metadata; optional google_sub for migration)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text,
  full_name text,
  google_sub text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, google_sub)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'sub'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Core tables (reviews use auth.users id, not Google sub)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.places (
  id bigserial PRIMARY KEY,
  name varchar(255) NOT NULL,
  location varchar(255) NOT NULL,
  price_range int CHECK (price_range IS NULL OR (price_range >= 1 AND price_range <= 5)),
  notes text,
  reviews_disabled boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.reviews (
  id bigserial PRIMARY KEY,
  place_id bigint NOT NULL REFERENCES public.places (id) ON DELETE CASCADE,
  name varchar(50) NOT NULL,
  review text NOT NULL,
  rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL DEFAULT auth.uid()
);

CREATE TABLE IF NOT EXISTS public.tags (
  id bigserial PRIMARY KEY,
  name varchar(64) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.place_tags (
  place_id bigint NOT NULL REFERENCES public.places (id) ON DELETE CASCADE,
  tag_id bigint NOT NULL REFERENCES public.tags (id) ON DELETE CASCADE,
  PRIMARY KEY (place_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_place_tags_tag_id ON public.place_tags (tag_id);

CREATE TABLE IF NOT EXISTS public.place_private_notes (
  id bigserial PRIMARY KEY,
  place_id bigint NOT NULL REFERENCES public.places (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  note_ciphertext text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (place_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_place_private_notes_place_user
  ON public.place_private_notes (place_id, user_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_private_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "places_authenticated_all"
  ON public.places FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "reviews_select_when_enabled"
  ON public.reviews FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.places p
      WHERE p.id = reviews.place_id AND p.reviews_disabled = false
    )
  );

CREATE POLICY "reviews_insert_own_when_enabled"
  ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.places p
      WHERE p.id = place_id AND p.reviews_disabled = false
    )
  );

CREATE POLICY "reviews_update_own"
  ON public.reviews FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "reviews_delete_own"
  ON public.reviews FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "tags_authenticated_read"
  ON public.tags FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "tags_authenticated_insert"
  ON public.tags FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "place_tags_authenticated_all"
  ON public.place_tags FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "private_notes_own_select"
  ON public.place_private_notes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "private_notes_own_insert"
  ON public.place_private_notes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "private_notes_own_update"
  ON public.place_private_notes FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "private_notes_own_delete"
  ON public.place_private_notes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RPC: list_places (tag AND filter, same semantics as server/queries/places.js)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_places(tag_filters text[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  filters text[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  filters := COALESCE(tag_filters, ARRAY[]::text[]);

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
        ORDER BY p.id
      ) s
    ),
    '[]'::jsonb
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: get_place_detail
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

  place_json := jsonb_build_object(
    'id', pl.id,
    'name', pl.name,
    'location', pl.location,
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
    'private_note', NULL::text
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

-- ---------------------------------------------------------------------------
-- RPC: link_tag_to_place (transactional upsert tag + link)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_tag_to_place(p_place_id bigint, p_tag_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trimmed text;
  tag_rec tags%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  trimmed := trim(p_tag_name);
  IF trimmed = '' THEN
    RAISE EXCEPTION 'tag name required' USING ERRCODE = '22000';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM places WHERE id = p_place_id) THEN
    RAISE EXCEPTION 'place not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO tag_rec FROM tags WHERE LOWER(name) = LOWER(trimmed) LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO tags (name) VALUES (trimmed) RETURNING * INTO tag_rec;
  END IF;

  INSERT INTO place_tags (place_id, tag_id)
  VALUES (p_place_id, tag_rec.id)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'tag',
    jsonb_build_object('id', tag_rec.id, 'name', tag_rec.name)
  );
END;
$$;

-- Grants: API uses authenticated JWT
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

GRANT EXECUTE ON FUNCTION public.list_places(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_place_detail(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_tag_to_place(bigint, text) TO authenticated;
