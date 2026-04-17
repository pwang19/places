import {
  isValidRatingInt,
  RATING_INVALID_MESSAGE,
} from "@places/shared";
import { FunctionsHttpError } from "@supabase/supabase-js";
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

/** Session access_token for Edge Functions (explicit header avoids anon-key Bearer fallback). */
async function accessTokenForFunctions() {
  if (!supabase) return null;
  const { error: guErr } = await supabase.auth.getUser();
  if (guErr) return null;
  const { error: refErr } = await supabase.auth.refreshSession();
  if (refErr) {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function invokePrivateNote(functionPath, options) {
  if (!supabase) throw apiError("Supabase is not configured", 500);
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!anon) throw apiError("Supabase is not configured", 500);

  const token = await accessTokenForFunctions();
  if (!token) throw apiError("Not authenticated", 401);

  const extraHeaders =
    options?.headers && typeof options.headers === "object" && !Array.isArray(options.headers)
      ? (options.headers as Record<string, string>)
      : {};

  const { data, error } = await supabase.functions.invoke(functionPath, {
    ...options,
    headers: {
      ...extraHeaders,
      Authorization: `Bearer ${token}`,
      apikey: anon,
    },
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const res = error.context;
      let jo = {};
      try {
        jo = await res.json();
      } catch {
        jo = {};
      }
      const joRec = jo as Record<string, unknown>;
      throw apiError(
        String(joRec.error || joRec.message || "Private note request failed"),
        res.status,
        joRec
      );
    }
    throw apiError(error.message || "Private note request failed", 500);
  }
  return data;
}

async function fetchPrivateNoteDecrypted(placeId) {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    return null;
  }
  try {
    const j = await invokePrivateNote(
      `private-note?place_id=${encodeURIComponent(String(placeId))}`,
      { method: "GET" }
    );
    return j?.note ?? null;
  } catch {
    return null;
  }
}

/** GET decrypted private note (edge function). Not part of place detail merge — load in parallel from UI. */
export async function getDecryptedPrivateNoteForPlace(placeId) {
  return fetchPrivateNoteDecrypted(placeId);
}

async function privateNoteRequest(method, placeId, body = undefined) {
  if (!supabase) throw apiError("Supabase is not configured", 500);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw apiError("Not authenticated", 401);
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    throw apiError("Supabase is not configured", 500);
  }

  if (method === "GET" || method === "DELETE") {
    return invokePrivateNote(
      `private-note?place_id=${encodeURIComponent(String(placeId))}`,
      { method }
    );
  }

  if (method === "PUT") {
    return invokePrivateNote("private-note", {
      method: "PUT",
      body: { place_id: Number(placeId), ...body },
    });
  }

  throw apiError("Unsupported method", 405);
}

function reviewForClient(row, myUserId) {
  const upvotes = Number(row.upvotes);
  const downvotes = Number(row.downvotes);
  const safeUp = Number.isFinite(upvotes) ? upvotes : 0;
  const safeDown = Number.isFinite(downvotes) ? downvotes : 0;
  const voteTotalRaw = Number(row.vote_total);
  const vote_total = Number.isFinite(voteTotalRaw) ? voteTotalRaw : safeUp - safeDown;
  const mv = row.my_vote;
  const my_vote = mv === 1 || mv === -1 ? mv : null;
  return {
    id: row.id,
    place_id: row.place_id,
    name: row.name,
    review: row.review,
    rating: row.rating,
    owned_by_me: Boolean(row.user_id && myUserId && row.user_id === myUserId),
    upvotes: safeUp,
    downvotes: safeDown,
    vote_total,
    my_vote,
  };
}

async function assertReviewOpenForVoting(placeId, reviewId, userId) {
  if (!supabase) throw apiError("Supabase is not configured", 500);
  const { data: rev, error: revErr } = await supabase
    .from("reviews")
    .select("id, place_id, user_id")
    .eq("id", reviewId)
    .maybeSingle();
  if (revErr) throw fromPostgrestError(revErr);
  if (!rev) throw apiError("Review not found", 404);
  if (Number(rev.place_id) !== placeId) throw apiError("Review not found", 404);
  if (rev.user_id === userId) throw apiError("Cannot vote on your own review", 403);
  const { data: pl, error: plErr } = await supabase
    .from("places")
    .select("reviews_disabled")
    .eq("id", placeId)
    .maybeSingle();
  if (plErr) throw fromPostgrestError(plErr);
  if (!pl) throw apiError("Place not found", 404);
  if (pl.reviews_disabled) throw apiError("Reviews are disabled for this place", 403);
}

async function listPlacesRpc(tagFilters, listFilters, flaggedOnly = false) {
  if (!supabase) throw apiError("Supabase is not configured", 500);
  const listIds = Array.isArray(listFilters)
    ? listFilters.map((n) => Number(n)).filter((n) => Number.isFinite(n))
    : [];
  const { data, error } = await supabase.rpc("list_places", {
    tag_filters: tagFilters.length ? tagFilters : null,
    list_filters: listIds.length ? listIds : null,
    p_flagged_only: Boolean(flaggedOnly),
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
  if (!Array.isArray(place.related_places)) {
    place.related_places = [];
  }
  const reviews = Array.isArray(payload.reviews) ? payload.reviews : [];
  place.private_note = null;
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
      const flaggedOnly = Boolean(config?.params?.flaggedOnly);
      const places = await listPlacesRpc(cleaned, cleanedListIds, flaggedOnly);
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

    const linksMatch = path.match(/^\/(\d+)\/links$/);
    if (linksMatch) {
      const placeId = Number(linksMatch[1]);
      const relatedId = Number(body?.related_place_id);
      if (!Number.isFinite(relatedId)) {
        throw apiError("related_place_id is required", 400);
      }
      const { error } = await supabase.rpc("link_places", {
        p_place_id: placeId,
        p_related_place_id: relatedId,
      });
      if (error) throw fromPostgrestError(error);
      const { place } = await getPlaceDetailMerged(placeId);
      return { data: { status: "Success", data: { place } } };
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
      const { count: existingCount, error: countErr } = await supabase
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("place_id", placeId)
        .eq("user_id", user.id);
      if (countErr) throw fromPostgrestError(countErr);
      if (existingCount && existingCount > 0) {
        throw apiError(
          "You already have a review for this place. Edit or delete it to post again.",
          409
        );
      }
      const { data: row, error } = await supabase
        .from("reviews")
        .insert({
          place_id: placeId,
          name: displayName,
          review,
          rating,
          user_id: user.id,
        })
        .select("*")
        .single();
      if (error) {
        if (error.code === "23505") {
          throw apiError(
            "You already have a review for this place. Edit or delete it to post again.",
            409
          );
        }
        throw fromPostgrestError(error);
      }
      return {
        data: {
          status: "Success",
          data: { review: reviewForClient(row, user.id) },
        },
      };
    }

    const reviewVoteMatch = path.match(/^\/(\d+)\/reviews\/(\d+)\/vote$/);
    if (reviewVoteMatch) {
      const placeId = Number(reviewVoteMatch[1]);
      const reviewId = Number(reviewVoteMatch[2]);
      const { data: { user }, error: uerr } = await supabase.auth.getUser();
      if (uerr || !user) throw apiError("Not authenticated", 401);
      const vote = Number(body?.vote);
      if (vote !== 1 && vote !== -1) {
        throw apiError("vote must be 1 (helpful) or -1 (unhelpful)", 400);
      }
      await assertReviewOpenForVoting(placeId, reviewId, user.id);
      const { error } = await supabase.from("review_votes").upsert(
        { review_id: reviewId, user_id: user.id, vote },
        { onConflict: "review_id,user_id" }
      );
      if (error) throw fromPostgrestError(error);
      return { data: { status: "Success", message: "Vote saved" } };
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

    const placeLinkMatch = path.match(/^\/(\d+)\/links\/(\d+)$/);
    if (placeLinkMatch) {
      const placeId = Number(placeLinkMatch[1]);
      const relatedId = Number(placeLinkMatch[2]);
      const { error } = await supabase.rpc("unlink_places", {
        p_place_id: placeId,
        p_related_place_id: relatedId,
      });
      if (error) throw fromPostgrestError(error);
      return { data: { status: "Success", message: "Link removed" } };
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

    const reviewVoteMatch = path.match(/^\/(\d+)\/reviews\/(\d+)\/vote$/);
    if (reviewVoteMatch) {
      const placeId = Number(reviewVoteMatch[1]);
      const reviewId = Number(reviewVoteMatch[2]);
      const { data: { user }, error: uerr } = await supabase.auth.getUser();
      if (uerr || !user) throw apiError("Not authenticated", 401);
      await assertReviewOpenForVoting(placeId, reviewId, user.id);
      const { error } = await supabase
        .from("review_votes")
        .delete({ count: "exact" })
        .eq("review_id", reviewId)
        .eq("user_id", user.id);
      if (error) throw fromPostgrestError(error);
      return { data: { status: "Success", message: "Vote removed" } };
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

export async function getAppAdmins() {
  if (!supabase) throw apiError("Supabase is not configured", 500);
  const { data, error } = await supabase.rpc("get_app_admins");
  if (error) throw fromPostgrestError(error);
  const arr = parseRpcPayload(data);
  if (!Array.isArray(arr)) return [];
  return arr.map((s) => String(s).trim()).filter(Boolean);
}

export async function replaceAppAdmins(usernames) {
  if (!supabase) throw apiError("Supabase is not configured", 500);
  const list = Array.isArray(usernames)
    ? usernames.map((s) => String(s).trim()).filter(Boolean)
    : [];
  const { error } = await supabase.rpc("replace_app_admins", {
    p_usernames: list,
  });
  if (error) throw fromPostgrestError(error);
}

export async function addPlaceFlagRpc(placeId, reason) {
  if (!supabase) throw apiError("Supabase is not configured", 500);
  const { error } = await supabase.rpc("add_place_flag", {
    p_place_id: Number(placeId),
    p_reason: String(reason ?? "").trim(),
  });
  if (error) throw fromPostgrestError(error);
}

export async function linkPlacesRpc(placeId, relatedPlaceId) {
  if (!supabase) throw apiError("Supabase is not configured", 500);
  const { error } = await supabase.rpc("link_places", {
    p_place_id: Number(placeId),
    p_related_place_id: Number(relatedPlaceId),
  });
  if (error) throw fromPostgrestError(error);
}

export async function unlinkPlacesRpc(placeId, relatedPlaceId) {
  if (!supabase) throw apiError("Supabase is not configured", 500);
  const { error } = await supabase.rpc("unlink_places", {
    p_place_id: Number(placeId),
    p_related_place_id: Number(relatedPlaceId),
  });
  if (error) throw fromPostgrestError(error);
}

export async function getPlaceFlagsRpc(placeId) {
  if (!supabase) throw apiError("Supabase is not configured", 500);
  const { data, error } = await supabase.rpc("get_place_flags", {
    p_place_id: Number(placeId),
  });
  if (error) throw fromPostgrestError(error);
  const arr = parseRpcPayload(data);
  return Array.isArray(arr) ? arr : [];
}

export async function dismissPlaceFlagsRpc(placeId) {
  if (!supabase) throw apiError("Supabase is not configured", 500);
  const { error } = await supabase.rpc("dismiss_place_flags", {
    p_place_id: Number(placeId),
  });
  if (error) throw fromPostgrestError(error);
}

export default PlaceFinder;
