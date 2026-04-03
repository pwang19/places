require("dotenv").config();
const db = require("./index");

const createPlacesTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS places (
        id BIGSERIAL NOT NULL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255) NOT NULL,
        price_range INT CHECK (price_range IS NULL OR (price_range >= 1 AND price_range <= 5)),
        notes TEXT,
        reviews_disabled BOOLEAN NOT NULL DEFAULT FALSE
      );
    `);
    console.log("✅ Places table created successfully!");
  } catch (err) {
    console.error("❌ Error creating places table:", err);
    process.exit(1);
  }
};

createPlacesTable()
  .then(() => {
    console.log("Setup complete!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Setup failed:", err);
    process.exit(1);
  });
