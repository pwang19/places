require("dotenv").config();
const db = require("./index");

const createPlacesTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS places (
        id BIGSERIAL NOT NULL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255) NOT NULL,
        price_range INT NOT NULL check(price_range >= 1 and price_range <= 5)
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
