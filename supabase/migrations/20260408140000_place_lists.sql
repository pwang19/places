-- Place lists: user-created lists of places (public or private), RLS, RPCs.
-- Extends get_place_detail with public_list_count.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.place_lists (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.place_list_items (
  list_id bigint NOT NULL REFERENCES public.place_lists (id) ON DELETE CASCADE,
  place_id bigint NOT NULL REFERENCES public.places (id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, place_id)
);

CREATE INDEX IF NOT EXISTS idx_place_list_items_place_id
  ON public.place_list_items (place_id);

-- ---------------------------------------------------------------------------
-- One-way public: cannot set is_public from true back to false
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_place_list_unpublish()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_public IS TRUE AND NEW.is_public IS FALSE THEN
    RAISE EXCEPTION 'public list cannot be made private' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS place_lists_no_unpublish ON public.place_lists;
CREATE TRIGGER place_lists_no_unpublish
  BEFORE UPDATE ON public.place_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_place_list_unpublish();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.place_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "place_lists_select_visible"
  ON public.place_lists FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_public);

CREATE POLICY "place_lists_insert_own"
  ON public.place_lists FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "place_lists_update_own"
  ON public.place_lists FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "place_lists_delete_own"
  ON public.place_lists FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "place_list_items_select_visible"
  ON public.place_list_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.place_lists pl
      WHERE pl.id = list_id
        AND (pl.user_id = auth.uid() OR pl.is_public)
    )
  );

CREATE POLICY "place_list_items_insert_allowed"
  ON public.place_list_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.place_lists pl
      WHERE pl.id = list_id
        AND (pl.is_public OR pl.user_id = auth.uid())
    )
  );

CREATE POLICY "place_list_items_delete_owner_only"
  ON public.place_list_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.place_lists pl
      WHERE pl.id = list_id
        AND pl.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- RPC: list_place_lists_picker
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_place_lists_picker()
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

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'is_public', s.is_public,
          'is_owner', s.is_owner
        )
        ORDER BY s.is_owner DESC, lower(s.name), s.id
      )
      FROM (
        SELECT pl.id, pl.name, pl.is_public, (pl.user_id = auth.uid()) AS is_owner
        FROM place_lists pl
        WHERE pl.user_id = auth.uid() OR pl.is_public
      ) s
    ),
    '[]'::jsonb
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: get_place_list_detail
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_place_list_detail(p_list_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l place_lists%ROWTYPE;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO l FROM place_lists WHERE id = p_list_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF l.user_id IS DISTINCT FROM uid AND NOT l.is_public THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'list',
    jsonb_build_object(
      'id', l.id,
      'name', l.name,
      'description', l.description,
      'is_public', l.is_public,
      'user_id', l.user_id,
      'is_owner', (l.user_id IS NOT DISTINCT FROM uid)
    ),
    'places',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'name', p.name,
            'location', p.location,
            'price_range', p.price_range
          )
          ORDER BY pli.added_at, p.id
        )
        FROM place_list_items pli
        JOIN places p ON p.id = pli.place_id
        WHERE pli.list_id = l.id
      ),
      '[]'::jsonb
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: create_place_list
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_place_list(
  p_name text,
  p_description text,
  p_is_public boolean,
  p_place_ids bigint[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  trimmed_name text;
  new_id bigint;
  pid bigint;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  trimmed_name := trim(p_name);
  IF trimmed_name = '' THEN
    RAISE EXCEPTION 'list name required' USING ERRCODE = '22000';
  END IF;

  INSERT INTO place_lists (user_id, name, description, is_public)
  VALUES (
    uid,
    trimmed_name,
    NULLIF(trim(p_description), ''),
    COALESCE(p_is_public, false)
  )
  RETURNING id INTO new_id;

  IF p_place_ids IS NOT NULL THEN
    FOREACH pid IN ARRAY p_place_ids
    LOOP
      IF pid IS NULL THEN
        CONTINUE;
      END IF;
      IF EXISTS (SELECT 1 FROM places WHERE id = pid) THEN
        INSERT INTO place_list_items (list_id, place_id)
        VALUES (new_id, pid)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('id', new_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: add_place_to_list
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_place_to_list(p_list_id bigint, p_place_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l place_lists%ROWTYPE;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM places WHERE id = p_place_id) THEN
    RAISE EXCEPTION 'place not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO l FROM place_lists WHERE id = p_list_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'list not found' USING ERRCODE = 'P0002';
  END IF;

  IF l.user_id IS DISTINCT FROM uid AND NOT l.is_public THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO place_list_items (list_id, place_id)
  VALUES (p_list_id, p_place_id)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: remove_place_from_list
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_place_from_list(p_list_id bigint, p_place_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l place_lists%ROWTYPE;
  uid uuid := auth.uid();
  deleted_count int;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO l FROM place_lists WHERE id = p_list_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'list not found' USING ERRCODE = 'P0002';
  END IF;

  IF l.user_id IS DISTINCT FROM uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  DELETE FROM place_list_items
  WHERE list_id = p_list_id AND place_id = p_place_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'removed', deleted_count > 0);
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: update_place_list_meta
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_place_list_meta(
  p_list_id bigint,
  p_name text,
  p_description text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l place_lists%ROWTYPE;
  uid uuid := auth.uid();
  trimmed_name text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO l FROM place_lists WHERE id = p_list_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'list not found' USING ERRCODE = 'P0002';
  END IF;

  IF l.user_id IS DISTINCT FROM uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  trimmed_name := trim(p_name);
  IF trimmed_name = '' THEN
    RAISE EXCEPTION 'list name required' USING ERRCODE = '22000';
  END IF;

  UPDATE place_lists
  SET
    name = trimmed_name,
    description = NULLIF(trim(p_description), ''),
    updated_at = now()
  WHERE id = p_list_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: set_place_list_public
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_place_list_public(p_list_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l place_lists%ROWTYPE;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO l FROM place_lists WHERE id = p_list_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'list not found' USING ERRCODE = 'P0002';
  END IF;

  IF l.user_id IS DISTINCT FROM uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE place_lists SET is_public = true, updated_at = now() WHERE id = p_list_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: get_place_detail (add public_list_count)
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

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT ALL ON TABLE public.place_lists TO authenticated;
GRANT ALL ON TABLE public.place_list_items TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.place_lists_id_seq TO authenticated;

GRANT EXECUTE ON FUNCTION public.list_place_lists_picker() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_place_list_detail(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_place_list(text, text, boolean, bigint[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_place_to_list(bigint, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_place_from_list(bigint, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_place_list_meta(bigint, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_place_list_public(bigint) TO authenticated;
