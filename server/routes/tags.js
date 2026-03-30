const express = require("express");
const db = require("../db");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = (req.query.q || "").trim();
    if (!q) {
      return res.status(200).json({
        status: "Success",
        data: { tags: [] },
      });
    }
    const results = await db.query(
      `SELECT id, name FROM tags WHERE name ILIKE $1 ORDER BY name ASC LIMIT 20`,
      [`%${q}%`]
    );
    res.status(200).json({
      status: "Success",
      data: { tags: results.rows },
    });
  })
);

module.exports = router;
