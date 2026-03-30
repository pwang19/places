require("dotenv").config();
const db = require("./index");

const createTagsTables = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS tags (
        id BIGSERIAL NOT NULL PRIMARY KEY,
        name VARCHAR(64) NOT NULL
      );
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS place_tags (
        place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
        tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (place_id, tag_id)
      );
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_place_tags_tag_id ON place_tags (tag_id);
    `);
    console.log("✅ Tags tables created successfully!");
  } catch (err) {
    console.error("❌ Error creating tags tables:", err);
    process.exit(1);
  }
};

createTagsTables()
  .then(() => {
    console.log("Setup complete!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Setup failed:", err);
    process.exit(1);
  });
