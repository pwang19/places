/**
 * Adds optional `notes` column to places for existing databases.
 * Safe to run multiple times.
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
  const has = await columnExists("places", "notes");
  if (has) {
    console.log("✅ Column places.notes already exists.");
    process.exit(0);
    return;
  }
  await db.query("ALTER TABLE places ADD COLUMN notes TEXT");
  console.log("✅ Added column places.notes.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ addPlaceNotesColumn failed:", err);
  process.exit(1);
});
