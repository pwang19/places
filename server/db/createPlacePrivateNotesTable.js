/**
 * Creates place_private_notes for per-user encrypted private notes. Safe to run multiple times.
 */
require("dotenv").config();
const db = require("./index");

async function tableExists(name) {
  const r = await db.query(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    ) AS e`,
    [name]
  );
  return r.rows[0].e;
}

async function main() {
  const exists = await tableExists("place_private_notes");
  if (exists) {
    console.log("✅ Table place_private_notes already exists.");
    process.exit(0);
    return;
  }
  await db.query(`
    CREATE TABLE place_private_notes (
      id BIGSERIAL NOT NULL PRIMARY KEY,
      place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
      user_sub VARCHAR(255) NOT NULL,
      note_ciphertext TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(place_id, user_sub)
    );
    CREATE INDEX idx_place_private_notes_place_user ON place_private_notes(place_id, user_sub);
  `);
  console.log("✅ Created table place_private_notes.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ createPlacePrivateNotesTable failed:", err);
  process.exit(1);
});
