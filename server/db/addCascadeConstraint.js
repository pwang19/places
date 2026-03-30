require("dotenv").config();
const db = require("./index");

/**
 * Ensures reviews.place_id CASCADE-deletes with the place.
 * For databases created before place_id existed, run npm run migrateToPlaces first.
 */
const addCascadeConstraint = async () => {
  try {
    await db.query(`
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 
          FROM information_schema.table_constraints 
          WHERE constraint_name = 'reviews_restaurant_id_fkey'
        ) THEN
          ALTER TABLE reviews DROP CONSTRAINT reviews_restaurant_id_fkey;
        END IF;
        IF EXISTS (
          SELECT 1 
          FROM information_schema.table_constraints 
          WHERE constraint_name = 'reviews_place_id_fkey'
        ) THEN
          ALTER TABLE reviews DROP CONSTRAINT reviews_place_id_fkey;
        END IF;
      END $$;
    `);

    await db.query(`
      ALTER TABLE reviews 
      ADD CONSTRAINT reviews_place_id_fkey 
      FOREIGN KEY (place_id) 
      REFERENCES places(id) 
      ON DELETE CASCADE;
    `);

    console.log("✅ CASCADE constraint added successfully!");
  } catch (err) {
    console.error("❌ Error adding CASCADE constraint:", err);
    process.exit(1);
  }
};

addCascadeConstraint()
  .then(() => {
    console.log("Setup complete!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Setup failed:", err);
    process.exit(1);
  });
