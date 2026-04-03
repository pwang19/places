/**
 * Allows places.price_range to be NULL (not applicable). Safe to run multiple times.
 */
require("dotenv").config();
const db = require("./index");

async function main() {
  const { rows } = await db.query(`
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'places'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%price_range%'
  `);
  for (const { conname } of rows) {
    await db.query(`ALTER TABLE places DROP CONSTRAINT IF EXISTS "${conname}"`);
  }

  await db.query(`ALTER TABLE places ALTER COLUMN price_range DROP NOT NULL`);

  await db.query(`
    ALTER TABLE places ADD CONSTRAINT places_price_range_check
    CHECK (price_range IS NULL OR (price_range >= 1 AND price_range <= 5))
  `);

  console.log("✅ price_range may be NULL (not applicable).");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ allowNullPriceRange failed:", err);
  process.exit(1);
});
