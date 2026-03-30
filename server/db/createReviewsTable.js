require("dotenv").config();
const db = require("./index");

const createReviewsTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id BIGSERIAL NOT NULL PRIMARY KEY,
        place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
        name VARCHAR(50) NOT NULL,
        review TEXT NOT NULL,
        rating INT NOT NULL check(rating >=1 and rating <=5)
      );
    `);
    console.log("✅ Reviews table created successfully!");
  } catch (err) {
    console.error("❌ Error creating reviews table:", err);
    process.exit(1);
  }
};

createReviewsTable()
  .then(() => {
    console.log("Setup complete!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Setup failed:", err);
    process.exit(1);
  });
