/**
 * Adds `user_sub` to reviews (existing databases). Safe to run multiple times.
 */
require("dotenv").config();
const db = require("../index");

async function columnExists(table, column) {
  const r = await db.query(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
    ) AS e`,
    [table, column]
  );
  return r.rows[0].e;
}

async function main() {
  const has = await columnExists("reviews", "user_sub");
  if (has) {
    console.log("✅ Column reviews.user_sub already exists.");
    process.exit(0);
    return;
  }
  await db.query("ALTER TABLE reviews ADD COLUMN user_sub VARCHAR(255) NULL");
  console.log("✅ Added column reviews.user_sub.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ addReviewsUserSubColumn failed:", err);
  process.exit(1);
});
