import {
  isValidRatingInt,
  RATING_INVALID_MESSAGE,
} from "@places/shared";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { postingAsLabel } from "../utils/displayName";

type ErrWithResponse = Error & {
  response?: { status: number; data: Record<string, unknown> };
};

function mapAuthUser(u) {
  if (!u) return null;
  return {
    sub: u.id,
    email: u.email,
    name: u.user_metadata?.full_name || u.user_metadata?.name,
  };
}

function apiError(message, status = 400, data = {}) {
  const err = new Error(message) as ErrWithResponse;
  err.response = { status, data: { message, ...data } };
  return err;
}

function fromPostgrestError(error) {
  const msg = error?.message || "Request failed";
  const err = new Error(msg) as ErrWithResponse;
  const code = error?.code;
  const status =
    code === "PGRST116" || code === "P0002" ? 404 : code === "42501" ? 403 : 400;
  err.response = { status, data: { message: msg, error: error?.details } };
  return err;
}

function normalizeContactPhone(v) {
  if (v == null) return null;
  const t = String(v).trim();
  return t || null;
}

function normalizeContactStringList(v) {
  if (v == null) return null;
  const arr = Array.isArray(v) ? v : [];
  const cleaned = [...new Set(arr.map((s) => String(s).trim()).filter(Boolean))];
  return cleaned.length ? cleaned : null;
}

async function fetchPrivateNoteDecrypted(placeId) {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!base || !anon) return null;
  const res = await fetch(
    `${base}/functions/v1/private-note?place_id=${encodeURIComponent(String(placeId))}`,
    {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: anon,
      },
    }
  );
  if (!res.ok) return null;
  const j = await res.json().catch(() => ({}));
  return j.note ?? null;
}

async function privateNoteRequest(method, placeId, body = undefined) {
  if (!supabase) throw apiError("Supabase is not configured", 500);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw apiError("Not authenticated", 401);
  const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!base || !anon) throw apiError("Supabase is not configured", 500);

  const url =
    method === "GET" || method === "DELETE"
      ? `${base}/functions/v1/private-note?place_id=${encodeURIComponent(String(placeId))}`
      : `${base}/functions/v1/private-note`;

  const opts: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: anon,
      "Content-Type": "application/json",
    },
  };
  if (method === "PUT" && body != null) {
    opts.body = JSON.stringify({ place_id: Number(placeId), ...body });
  }

  const res = await fetch(url, opts);
  const text = await res.text();
  let j = {};
  if (text) {
    try {
      j = JSON.parse(text);
    } catch {
      j = {};
    }
  }
  if (!res.ok) {
    const jo = j as Record<string, unknown>;
    throw apiError(
      String(jo.error || jo.message || "Private note request failed"),
      res.status,
      jo
    );
  }
  return j;
}

function reviewForClient(row, myUserId) {
  return {
    id: row.id,
    place_id: row.place_id,
    name: row.name,
    review: row.review,
    rating: row.rating,
    owned_by_me: Boolean(row.user_id && myUserId && row.user_id === myUserId),
  };
}

async function listPlacesRpc(tagFilters, listFilters) {
  if (!supabase) throw apiError("Supabase is not configured", 500);
  const listIds = Array.isArray(listFilters)
    ? listFilters.map((n) => Number(n)).filter((n) => Number.isFinite(n))
    : [];
  const { data, error } = await supabase.rpc("list_places", {
    tag_filters: tagFilters.length ? tagFilters : null,
    list_filters: listIds.length ? listIds : null,
  });
  if (error) throw fromPostgrestError(error);
  const parsed = parseRpcPayload(data);
  const arr = Array.isArray(parsed) ? parsed : [];
  return arr;
}

async function getPlaceDetailMerged(placeId) {
  if (!supabase) throw apiError("Supabase is not configured", 500);
  const { data, error } = await supabase.rpc("get_place_detail", {
    p_place_id: Number(placeId),
  });
  if (error) throw fromPostgrestError(error);
  let payload = data;
  if (typeof data === "string") {
    try {
      payload = JSON.parse(data);
    } catch {
      payload = null;
    }
  }
  if (payload == null) throw apiError("Place not found", 404, { message: "Place not found" });

  const place = { ...payload.place };
  const reviews = Array.isArray(payload.reviews) ? payload.reviews : [];
  place.private_note = await fetchPrivateNoteDecrypted(placeId);
  return { place, reviews };
}

/**
 * Axios-like API for places (compat with existing components).
 */
const PlaceFinder = {
  async get(path, config?) {
    if (!isSupabaseConfigured()) {
      throw apiError("Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY", 500);
    }

    if (path === "/" || path === "") {
      const raw = config?.params?.tag;
      const tagList = Array.isArray(raw) ? raw : raw != null && raw !== "" ? [raw] : [];
      const cleaned = tagList.map((t) => String(t).trim()).filter(Boolean);
      const rawListIds = config?.params?.list;
      const listIdArr = Array.isArray(rawListIds)
        ? rawListIds
        : rawListIds != null && rawListIds !== ""
          ? [rawListIds]
          : [];
      const cleanedListIds = listIdArr
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n));
      const places = await listPlacesRpc(cleaned, cleanedListIds);
      return {
        data: { status: "Success", results: places.length, data: { places } },
      };
    }

    const detailMatch = path.match(/^\/(\d+)$/);
    if (detailMatch) {
      const { place, reviews } = await getPlaceDetailMerged(detailMatch[1]);
      return {
        data: { status: "Success", data: { place, reviews } },
      };
    }

    throw apiError("Not found", 404);
  },

  async post(path, body) {
    if (!isSupabaseConfigured()) {
      throw apiError("Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY", 500);
    }

    if (path === "/" || path === "") {
      const row = {
        name: body.name,
        location: body.location,
        phone: normalizeContactPhone(body.phone),
        emails: normalizeContactStringList(body.emails),
        websites: normalizeContactStringList(body.websites),
        price_range: body.price_range ?? null,
        notes: body.notes != null && String(body.notes).trim() ? String(body.notes).trim() : null,
        reviews_disabled: Boolean(body.reviews_disabled),
      };
      const { data: inserted, error } = await supabase
        .from("places")
        .insert(row)
        .select("id")
        .single();
      if (error) throw fromPostgrestError(error);
      const { place } = await getPlaceDetailMerged(inserted.id);
      return { data: { status: "Success", data: { place } } };
    }

    const tagMatch = path.match(/^\/(\d+)\/tags$/);
    if (tagMatch) {
      const placeId = Number(tagMatch[1]);
      const name = (body && body.name ? String(body.name) : "").trim();
      if (!name) throw apiError("Tag name is required", 400);
      const { data, error } = await supabase.rpc("link_tag_to_place", {
        p_place_id: placeId,
        p_tag_name: name,
      });
      if (error) {
        const msg = (error.message || "").toLowerCase();
        if (msg.includes("place not found") || msg.includes("p0002")) {
          throw apiError("Place not found", 404);
        }
        throw fromPostgrestError(error);
      }
      const tagPayload = data && typeof data === "object" ? data : {};
      return { data: { status: "Success", data: { tag: tagPayload.tag } } };
    }

    const reviewMatch = path.match(/^\/(\d+)\/addReview$/);
    if (reviewMatch) {
      const placeId = Number(reviewMatch[1]);
      const { data: { user }, error: uerr } = await supabase.auth.getUser();
      if (uerr || !user) throw apiError("Not authenticated", 401);
      const displayName = postingAsLabel(mapAuthUser(user));
      const review = String(body.review || "").trim();
      if (!review) throw apiError("review is required", 400);
      const rating = Number(body.rating);
      if (!isValidRatingInt(rating)) {
        throw apiError(RATING_INVALID_MESSAGE, 400);
      }
      const { data: row, error } = await supabase
        .from("reviews")
        .insert({
          place_id: placeId,
          name: displayName,
          review,
          rating,
        })
        .select("*")
        .single();
      if (error) throw fromPostgrestError(error);
      return {
        data: {
          status: "Success",
          data: { review: reviewForClient(row, user.id) },
        },
      };
    }

    throw apiError("Not found", 404);
  },

  async put(path, body) {
    if (!isSupabaseConfigured()) {
      throw apiError("Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY", 500);
    }

    const privateNoteMatch = path.match(/^\/(\d+)\/private-note$/);
    if (privateNoteMatch) {
      await privateNoteRequest("PUT", privateNoteMatch[1], { note: body.note });
      const { place } = await getPlaceDetailMerged(privateNoteMatch[1]);
      return { data: { status: "Success", data: { place } } };
    }

    const reviewMatch = path.match(/^\/(\d+)\/reviews\/(\d+)$/);
    if (reviewMatch) {
      const placeId = Number(reviewMatch[1]);
      const reviewId = Number(reviewMatch[2]);
      const review = String(body.review || "").trim();
      if (!review) throw apiError("review is required", 400);
      const rating = Number(body.rating);
      if (!isValidRatingInt(rating)) {
        throw apiError(RATING_INVALID_MESSAGE, 400);
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw apiError("Not authenticated", 401);
      const { data: row, error } = await supabase
        .from("reviews")
        .update({ review, rating })
        .eq("id", reviewId)
        .eq("place_id", placeId)
        .select("*")
        .single();
      if (error) throw fromPostgrestError(error);
      if (!row) throw apiError("Review not found", 404);
      return {
        data: {
          status: "Success",
          data: { review: reviewForClient(row, user.id) },
        },
      };
    }

    const placeMatch = path.match(/^\/(\d+)$/);
    if (placeMatch) {
      const id = Number(placeMatch[1]);
      const updates = {
        name: body.name,
        location: body.location,
        phone: normalizeContactPhone(body.phone),
        emails: normalizeContactStringList(body.emails),
        websites: normalizeContactStringList(body.websites),
        price_range: body.price_range ?? null,
        notes:
          body.notes != null && String(body.notes).trim()
            ? String(body.notes).trim()
            : null,
        reviews_disabled: Boolean(body.reviews_disabled),
      };
      const { data: rows, error } = await supabase
        .from("places")
        .update(updates)
        .eq("id", id)
        .select("id");
      if (error) throw fromPostgrestError(error);
      if (!rows?.length) throw apiError("Place not found", 404);
      const { place } = await getPlaceDetailMerged(id);
      return { data: { status: "Success", data: { place } } };
    }

    throw apiError("Not found", 404);
  },

  async delete(path) {
    if (!isSupabaseConfigured()) {
      throw apiError("Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY", 500);
    }

    const privateNoteMatch = path.match(/^\/(\d+)\/private-note$/);
    if (privateNoteMatch) {
      await privateNoteRequest("DELETE", privateNoteMatch[1]);
      return { data: { status: "Success", message: "Private note removed" } };
    }

    const tagMatch = path.match(/^\/(\d+)\/tags\/(\d+)$/);
    if (tagMatch) {
      const placeId = Number(tagMatch[1]);
      const tagId = Number(tagMatch[2]);
      const { error, count } = await supabase
        .from("place_tags")
        .delete({ count: "exact" })
        .eq("place_id", placeId)
        .eq("tag_id", tagId);
      if (error) throw fromPostgrestError(error);
      if (!count) throw apiError("Tag not linked to this place", 404);
      return { data: { status: "Success", message: "Tag removed" } };
    }

    const reviewMatch = path.match(/^\/(\d+)\/reviews\/(\d+)$/);
    if (reviewMatch) {
      const placeId = Number(reviewMatch[1]);
      const reviewId = Number(reviewMatch[2]);
      const { error, count } = await supabase
        .from("reviews")
        .delete({ count: "exact" })
        .eq("id", reviewId)
        .eq("place_id", placeId);
      if (error) throw fromPostgrestError(error);
      if (!count) throw apiError("Review not found", 404);
      return { data: { status: "Success", message: "Review deleted" } };
    }

    const placeMatch = path.match(/^\/(\d+)$/);
    if (placeMatch) {
      const id = Number(placeMatch[1]);
      const { error, count } = await supabase
        .from("places")
        .delete({ count: "exact" })
        .eq("id", id);
      if (error) throw fromPostgrestError(error);
      if (!count) throw apiError("Place not found", 404);
      return {
        data: {
          status: "Success",
          message: "Place and all associated data deleted successfully",
        },
      };
    }

    throw apiError("Not found", 404);
  },
};

function parseRpcPayload(data) {
  let p = data;
  if (typeof data === "string") {
    try {
      p = JSON.parse(data);
    } catch {
      p = null;
    }
  }
  return p;
}

export async function listPlaceListsPicker() {
  if (!supabase) throw apiError("Supabase is not configured", 500);
  const { data, error } = await supabase.rpc("list_place_lists_picker");
  if (error) throw fromPostgrestError(error);
  const arr = parseRpcPayload(data);
  return Array.isArray(arr) ? arr : [];
}

export async function getPlaceListDetailRpc(listId) {
  if (!supabase) throw apiError("Supabase is not configured", 500);
  const { data, error } = await supabase.rpc("get_place_list_detail", {
    p_list_id: Number(listId),
  });
  if (error) throw fromPostgrestError(error);
  const payload = parseRpcPayload(data);
  if (payload == null) throw apiError("List not found", 404);
  return payload;
}

export async function createPlaceListRpc(name, description, isPublic, placeIds) {
  if (!supabase) throw apiError("Supabase is not configured", 500);
  const ids = Array.isArray(placeIds)
    ? placeIds.map((n) => Number(n)).filter((n) => Number.isFinite(n))
    : [];
  const { data, error } = await supabase.rpc("create_place_list", {
    p_name: String(name ?? "").trim(),
    p_description: description != null ? String(description) : null,
    p_is_public: Boolean(isPublic),
    p_place_ids: ids.length ? ids : [],
  });
  if (error) throw fromPostgrestError(error);
  const payload = parseRpcPayload(data);
  const id = payload && payload.id != null ? Number(payload.id) : NaN;
  if (!Number.isFinite(id)) throw apiError("Create list failed", 500);
  return id;
}

export async function addPlaceToListRpc(listId, placeId) {
  if (!supabase) throw apiError("Supabase is not configured", 500);
  const { error } = await supabase.rpc("add_place_to_list", {
    p_list_id: Number(listId),
    p_place_id: Number(placeId),
  });
  if (error) throw fromPostgrestError(error);
}

export async function removePlaceFromListRpc(listId, placeId) {
  if (!supabase) throw apiError("Supabase is not configured", 500);
  const { error } = await supabase.rpc("remove_place_from_list", {
    p_list_id: Number(listId),
    p_place_id: Number(placeId),
  });
  if (error) throw fromPostgrestError(error);
}

export async function updatePlaceListMetaRpc(listId, name, description) {
  if (!supabase) throw apiError("Supabase is not configured", 500);
  const { error } = await supabase.rpc("update_place_list_meta", {
    p_list_id: Number(listId),
    p_name: String(name ?? "").trim(),
    p_description: description != null ? String(description) : null,
  });
  if (error) throw fromPostgrestError(error);
}

export async function setPlaceListPublicRpc(listId) {
  if (!supabase) throw apiError("Supabase is not configured", 500);
  const { error } = await supabase.rpc("set_place_list_public", {
    p_list_id: Number(listId),
  });
  if (error) throw fromPostgrestError(error);
}

export async function deletePlaceListRpc(listId) {
  if (!supabase) throw apiError("Supabase is not configured", 500);
  const { error, count } = await supabase
    .from("place_lists")
    .delete({ count: "exact" })
    .eq("id", Number(listId));
  if (error) throw fromPostgrestError(error);
  if (!count) throw apiError("List not found", 404);
}

export default PlaceFinder;
