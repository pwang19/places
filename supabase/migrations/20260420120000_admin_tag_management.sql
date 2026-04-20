-- Admin-only tag rename, merge (reassign place_tags, drop merged tags), and delete (cascade place_tags).

CREATE OR REPLACE FUNCTION public.admin_rename_tag(p_tag_id bigint, p_new_name text)
RETURNS jsonb
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
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  trimmed := trim(p_new_name);
  IF trimmed = '' THEN
    RAISE EXCEPTION 'tag name required' USING ERRCODE = '22000';
  END IF;

  IF char_length(trimmed) > 64 THEN
    RAISE EXCEPTION 'tag name too long' USING ERRCODE = '22000';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tags WHERE id = p_tag_id) THEN
    RAISE EXCEPTION 'tag not found' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.tags
    WHERE id <> p_tag_id AND lower(name) = lower(trimmed)
  ) THEN
    RAISE EXCEPTION 'a tag with that name already exists' USING ERRCODE = '23505';
  END IF;

  UPDATE public.tags SET name = trimmed WHERE id = p_tag_id;

  RETURN jsonb_build_object('id', p_tag_id, 'name', trimmed);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_merge_tags(p_keep_tag_id bigint, p_merge_tag_ids bigint[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tid bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  IF p_merge_tag_ids IS NULL OR cardinality(p_merge_tag_ids) = 0 THEN
    RAISE EXCEPTION 'no tags to merge' USING ERRCODE = '22000';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tags WHERE id = p_keep_tag_id) THEN
    RAISE EXCEPTION 'tag not found' USING ERRCODE = 'P0002';
  END IF;

  FOR tid IN SELECT DISTINCT unnest(p_merge_tag_ids)
  LOOP
    CONTINUE WHEN tid IS NULL;
    CONTINUE WHEN tid = p_keep_tag_id;

    IF NOT EXISTS (SELECT 1 FROM public.tags WHERE id = tid) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.place_tags (place_id, tag_id)
    SELECT pt.place_id, p_keep_tag_id
    FROM public.place_tags pt
    WHERE pt.tag_id = tid
    ON CONFLICT DO NOTHING;

    DELETE FROM public.place_tags WHERE tag_id = tid;
    DELETE FROM public.tags WHERE id = tid;
  END LOOP;

  RETURN jsonb_build_object('kept_id', p_keep_tag_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_tag(p_tag_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.tags WHERE id = p_tag_id;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  IF deleted = 0 THEN
    RAISE EXCEPTION 'tag not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_rename_tag(bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_merge_tags(bigint, bigint[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_tag(bigint) TO authenticated;
