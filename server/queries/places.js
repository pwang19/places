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

const placeSelectSql = `SELECT p.id, p.name, p.location, p.price_range,
  reviews.count,
  reviews.average_rating,
  ${tagsJsonSelect("p")}
${PLACE_FROM_REVIEWS}`;

async function fetchPlaceRowById(id) {
  const place = await db.query(`${placeSelectSql} WHERE p.id = $1`, [id]);
  return place.rows[0] || null;
}

async function listPlaceRows(tagFilter) {
  const tag = (tagFilter || "").trim();
  const whereClause = tag
    ? `WHERE EXISTS (
        SELECT 1 FROM place_tags ptf
        JOIN tags tf ON tf.id = ptf.tag_id
        WHERE ptf.place_id = p.id AND tf.name ILIKE $1
      )`
    : "";
  const params = tag ? [`%${tag}%`] : [];
  const result = await db.query(`${placeSelectSql} ${whereClause}`, params);
  return result.rows;
}

module.exports = {
  fetchPlaceRowById,
  listPlaceRows,
};
