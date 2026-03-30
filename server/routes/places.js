const express = require("express");
const db = require("../db");
const { fetchPlaceRowById, listPlaceRows } = require("../queries/places");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const rows = await listPlaceRows(req.query.tag);
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
      "INSERT INTO places (name, location, price_range) VALUES ($1, $2, $3) RETURNING id",
      [req.body.name, req.body.location, req.body.price_range]
    );
    const placeRow = await fetchPlaceRowById(results.rows[0].id);
    res.status(201).json({
      status: "Success",
      data: { place: placeRow },
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
    const reviews = await db.query(
      "SELECT * FROM reviews WHERE place_id = $1 ORDER BY id DESC",
      [req.params.id]
    );
    res.status(200).json({
      status: "Success",
      data: {
        place: placeRow,
        reviews: reviews.rows,
      },
    });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const results = await db.query(
      "UPDATE places SET name = $1, location = $2, price_range = $3 WHERE id = $4 RETURNING id",
      [req.body.name, req.body.location, req.body.price_range, req.params.id]
    );
    if (results.rowCount === 0) {
      return res.status(404).json({ status: "Error", message: "Place not found" });
    }
    const placeRow = await fetchPlaceRowById(req.params.id);
    res.status(200).json({
      status: "Success",
      data: { place: placeRow },
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
    const newReview = await db.query(
      "INSERT INTO reviews (place_id, name, review, rating) VALUES ($1, $2, $3, $4) RETURNING *",
      [req.params.id, req.body.name, req.body.review, req.body.rating]
    );
    res.status(201).json({
      status: "Success",
      data: { review: newReview.rows[0] },
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
