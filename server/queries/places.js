const db = require("../db");

const tagsJsonSelect = (alias = "p") => `(
  SELECT COALESCE(json_agg(json_build_object('id', t.id, 'name', t.name) ORDER BY t.name), '[]'::json)
  FROM place_tags pt
  JOIN tags t ON t.id = pt.tag_id
  WHERE pt.place_id = ${alias}.id
) AS tags`;

const PLACE_FROM_REVIEWS = `
  FROM places p
  LEFT JOIN (
    SELECT place_id, COUNT(*)::int AS count, TRUNC(AVG(rating),1) AS average_rating
    FROM reviews GROUP BY place_id
  ) reviews ON p.id = reviews.place_id
`;

const placeSelectSql = `SELECT p.id, p.name, p.location, p.price_range, p.notes,
  reviews.count,
  reviews.average_rating,
  ${tagsJsonSelect("p")}
${PLACE_FROM_REVIEWS}`;

async function fetchPlaceRowById(id) {
  const place = await db.query(`${placeSelectSql} WHERE p.id = $1`, [id]);
  return place.rows[0] || null;
}

async function listPlaceRows(tagFilters) {
  const cleaned = (Array.isArray(tagFilters) ? tagFilters : [])
    .map((t) => String(t).trim())
    .filter(Boolean);
  if (cleaned.length === 0) {
    const result = await db.query(placeSelectSql);
    return result.rows;
  }
  const existsClauses = cleaned.map(
    (_, i) => `EXISTS (
      SELECT 1 FROM place_tags ptf
      JOIN tags tf ON tf.id = ptf.tag_id
      WHERE ptf.place_id = p.id AND tf.name ILIKE $${i + 1}
    )`
  );
  const whereClause = `WHERE ${existsClauses.join(" AND ")}`;
  const params = cleaned.map((t) => `%${t}%`);
  const result = await db.query(`${placeSelectSql} ${whereClause}`, params);
  return result.rows;
}

module.exports = {
  fetchPlaceRowById,
  listPlaceRows,
};
