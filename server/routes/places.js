const express = require("express");
const db = require("../db");
const { fetchPlaceRowById, listPlaceRows } = require("../queries/places");
const asyncHandler = require("../middleware/asyncHandler");
const { encrypt, decrypt } = require("../services/privateNoteCrypto");
const { displayNameFromUser } = require("../lib/displayName");
const {
  isValidPriceRangeInt,
  isValidRatingInt,
  PRICE_RANGE_INVALID_MESSAGE,
  RATING_INVALID_MESSAGE,
} = require("@places/shared");

const router = express.Router();

function normalizeNotes(body) {
  if (!body || body.notes == null) return null;
  const s = String(body.notes).trim();
  return s.length ? s : null;
}

function normalizeReviewsDisabled(body) {
  if (!body || body.reviews_disabled == null) return false;
  if (typeof body.reviews_disabled === "boolean") return body.reviews_disabled;
  const s = String(body.reviews_disabled).toLowerCase();
  if (s === "true" || s === "1") return true;
  if (s === "false" || s === "0" || s === "") return false;
  return Boolean(body.reviews_disabled);
}

function normalizePriceRange(body) {
  if (
    !body ||
    body.price_range === undefined ||
    body.price_range === null ||
    body.price_range === ""
  ) {
    return null;
  }
  const n = Number(body.price_range);
  if (!isValidPriceRangeInt(n)) {
    const err = new Error(PRICE_RANGE_INVALID_MESSAGE);
    err.status = 400;
    throw err;
  }
  return n;
}

function normalizeTagQuery(query) {
  const raw = query.tag;
  if (raw == null || raw === "") return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((t) => String(t).trim()).filter(Boolean);
}

function parseReviewBody(body) {
  if (!body || body.review == null) {
    const err = new Error("review is required");
    err.status = 400;
    throw err;
  }
  const review = String(body.review).trim();
  if (!review) {
    const err = new Error("review cannot be empty");
    err.status = 400;
    throw err;
  }
  const n = Number(body.rating);
  if (!isValidRatingInt(n)) {
    const err = new Error(RATING_INVALID_MESSAGE);
    err.status = 400;
    throw err;
  }
  return { review, rating: n };
}

function reviewForClient(row, currentSub) {
  const owned = Boolean(row.user_sub && row.user_sub === currentSub);
  return {
    id: row.id,
    place_id: row.place_id,
    name: row.name,
    review: row.review,
    rating: row.rating,
    owned_by_me: owned,
  };
}

async function attachPrivateNote(placeRow, userSub) {
  if (!placeRow) return null;
  const base = { ...placeRow };
  const r = await db.query(
    "SELECT note_ciphertext FROM place_private_notes WHERE place_id = $1 AND user_sub = $2",
    [placeRow.id, userSub]
  );
  if (!r.rows.length) {
    base.private_note = null;
    return base;
  }
  base.private_note = decrypt(r.rows[0].note_ciphertext);
  return base;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const rows = await listPlaceRows(normalizeTagQuery(req.query));
    res.status(200).json({
      status: "Success",
      results: rows.length,
      data: { places: rows },
    });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const results = await db.query(
      "INSERT INTO places (name, location, price_range, notes, reviews_disabled) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [
        req.body.name,
        req.body.location,
        normalizePriceRange(req.body),
        normalizeNotes(req.body),
        normalizeReviewsDisabled(req.body),
      ]
    );
    const placeRow = await fetchPlaceRowById(results.rows[0].id);
    const placeOut = await attachPrivateNote(placeRow, req.user.sub);
    res.status(201).json({
      status: "Success",
      data: { place: placeOut },
    });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const placeRow = await fetchPlaceRowById(req.params.id);
    if (!placeRow) {
      return res.status(404).json({
        status: "Error",
        message: "Place not found",
      });
    }
    const placeOut = await attachPrivateNote(placeRow, req.user.sub);
    if (placeRow.reviews_disabled) {
      res.status(200).json({
        status: "Success",
        data: {
          place: placeOut,
          reviews: [],
        },
      });
      return;
    }
    const currentSub = req.user.sub;
    const reviews = await db.query(
      `SELECT * FROM reviews WHERE place_id = $1
       ORDER BY CASE WHEN user_sub IS NOT DISTINCT FROM $2::varchar THEN 0 ELSE 1 END, id DESC`,
      [req.params.id, currentSub]
    );
    const reviewsOut = reviews.rows.map((row) => reviewForClient(row, currentSub));
    res.status(200).json({
      status: "Success",
      data: {
        place: placeOut,
        reviews: reviewsOut,
      },
    });
  })
);

router.put(
  "/:id/reviews/:reviewId",
  asyncHandler(async (req, res) => {
    const placeRow = await fetchPlaceRowById(req.params.id);
    if (!placeRow) {
      return res.status(404).json({ status: "Error", message: "Place not found" });
    }
    const { review, rating } = parseReviewBody(req.body);
    const result = await db.query(
      `UPDATE reviews SET review = $1, rating = $2
       WHERE id = $3 AND place_id = $4 AND user_sub = $5
       RETURNING id, place_id, name, review, rating, user_sub`,
      [review, rating, req.params.reviewId, req.params.id, req.user.sub]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ status: "Error", message: "Review not found" });
    }
    const row = result.rows[0];
    res.status(200).json({
      status: "Success",
      data: { review: reviewForClient(row, req.user.sub) },
    });
  })
);

router.delete(
  "/:id/reviews/:reviewId",
  asyncHandler(async (req, res) => {
    const placeRow = await fetchPlaceRowById(req.params.id);
    if (!placeRow) {
      return res.status(404).json({ status: "Error", message: "Place not found" });
    }
    const result = await db.query(
      "DELETE FROM reviews WHERE id = $1 AND place_id = $2 AND user_sub = $3",
      [req.params.reviewId, req.params.id, req.user.sub]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ status: "Error", message: "Review not found" });
    }
    res.status(200).json({ status: "Success", message: "Review deleted" });
  })
);

router.put(
  "/:id/private-note",
  asyncHandler(async (req, res) => {
    const placeRow = await fetchPlaceRowById(req.params.id);
    if (!placeRow) {
      return res.status(404).json({ status: "Error", message: "Place not found" });
    }
    const raw = req.body && req.body.note != null ? String(req.body.note) : "";
    const trimmed = raw.trim();
    const userSub = req.user.sub;
    if (!trimmed) {
      await db.query(
        "DELETE FROM place_private_notes WHERE place_id = $1 AND user_sub = $2",
        [req.params.id, userSub]
      );
      const updated = await fetchPlaceRowById(req.params.id);
      const placeOut = await attachPrivateNote(updated, userSub);
      res.status(200).json({ status: "Success", data: { place: placeOut } });
      return;
    }
    const ciphertext = encrypt(trimmed);
    await db.query(
      `INSERT INTO place_private_notes (place_id, user_sub, note_ciphertext)
       VALUES ($1, $2, $3)
       ON CONFLICT (place_id, user_sub)
       DO UPDATE SET note_ciphertext = EXCLUDED.note_ciphertext, updated_at = NOW()`,
      [req.params.id, userSub, ciphertext]
    );
    const updated = await fetchPlaceRowById(req.params.id);
    const placeOut = await attachPrivateNote(updated, userSub);
    res.status(200).json({ status: "Success", data: { place: placeOut } });
  })
);

router.delete(
  "/:id/private-note",
  asyncHandler(async (req, res) => {
    const placeRow = await fetchPlaceRowById(req.params.id);
    if (!placeRow) {
      return res.status(404).json({ status: "Error", message: "Place not found" });
    }
    await db.query(
      "DELETE FROM place_private_notes WHERE place_id = $1 AND user_sub = $2",
      [req.params.id, req.user.sub]
    );
    const updated = await fetchPlaceRowById(req.params.id);
    const placeOut = await attachPrivateNote(updated, req.user.sub);
    res.status(200).json({ status: "Success", data: { place: placeOut } });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const results = await db.query(
      "UPDATE places SET name = $1, location = $2, price_range = $3, notes = $4, reviews_disabled = $5 WHERE id = $6 RETURNING id",
      [
        req.body.name,
        req.body.location,
        normalizePriceRange(req.body),
        normalizeNotes(req.body),
        normalizeReviewsDisabled(req.body),
        req.params.id,
      ]
    );
    if (results.rowCount === 0) {
      return res.status(404).json({ status: "Error", message: "Place not found" });
    }
    const placeRow = await fetchPlaceRowById(req.params.id);
    const placeOut = await attachPrivateNote(placeRow, req.user.sub);
    res.status(200).json({
      status: "Success",
      data: { place: placeOut },
    });
  })
);

router.post(
  "/:id/tags",
  asyncHandler(async (req, res) => {
    const name = (req.body && req.body.name ? String(req.body.name) : "").trim();
    if (!name) {
      return res.status(400).json({ status: "Error", message: "Tag name is required" });
    }
    const placeId = req.params.id;
    const client = await db.pool.connect();
    let transactionStarted = false;
    try {
      await client.query("BEGIN");
      transactionStarted = true;
      const existing = await client.query(
        "SELECT id, name FROM tags WHERE LOWER(name) = LOWER($1) LIMIT 1",
        [name]
      );
      let tag;
      if (existing.rows.length) {
        tag = existing.rows[0];
      } else {
        const inserted = await client.query(
          "INSERT INTO tags (name) VALUES ($1) RETURNING id, name",
          [name]
        );
        tag = inserted.rows[0];
      }
      await client.query(
        `INSERT INTO place_tags (place_id, tag_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [placeId, tag.id]
      );
      await client.query("COMMIT");
      transactionStarted = false;
      res.status(200).json({
        status: "Success",
        data: { tag },
      });
    } catch (err) {
      if (transactionStarted) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackErr) {
          console.error(rollbackErr);
        }
      }
      throw err;
    } finally {
      client.release();
    }
  })
);

router.delete(
  "/:id/tags/:tagId",
  asyncHandler(async (req, res) => {
    const result = await db.query(
      "DELETE FROM place_tags WHERE place_id = $1 AND tag_id = $2",
      [req.params.id, req.params.tagId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({
        status: "Error",
        message: "Tag not linked to this place",
      });
    }
    res.status(200).json({ status: "Success", message: "Tag removed" });
  })
);

router.post(
  "/:id/addReview",
  asyncHandler(async (req, res) => {
    const placeRow = await fetchPlaceRowById(req.params.id);
    if (!placeRow) {
      return res.status(404).json({ status: "Error", message: "Place not found" });
    }
    if (placeRow.reviews_disabled) {
      return res.status(403).json({
        status: "Error",
        message: "Reviews are disabled for this place",
      });
    }
    const existing = await db.query(
      "SELECT id FROM reviews WHERE place_id = $1 AND user_sub = $2 LIMIT 1",
      [req.params.id, req.user.sub]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({
        status: "Error",
        message: "You already have a review for this place. Edit or delete it to post again.",
      });
    }
    const { review, rating } = parseReviewBody(req.body);
    const displayName = displayNameFromUser(req.user);
    const newReview = await db.query(
      "INSERT INTO reviews (place_id, name, review, rating, user_sub) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [req.params.id, displayName, review, rating, req.user.sub]
    );
    const row = newReview.rows[0];
    res.status(201).json({
      status: "Success",
      data: { review: reviewForClient(row, req.user.sub) },
    });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const results = await db.query("DELETE FROM places WHERE id = $1", [
      req.params.id,
    ]);
    if (results.rowCount === 0) {
      return res.status(404).json({
        status: "Error",
        message: "Place not found",
      });
    }
    res.status(200).json({
      status: "Success",
      message: "Place and all associated data deleted successfully",
    });
  })
);

module.exports = router;
