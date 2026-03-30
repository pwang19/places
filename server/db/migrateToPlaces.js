/**
 * One-time migration from legacy table names (restaurants, restaurant_id, restaurant_tags)
 * to places, place_id, and place_tags. Run once if upgrading an older database.
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

const migrateToPlaces = async () => {
  const hasLegacyPlaces = await tableExists("restaurants");
  const hasPlaces = await tableExists("places");
  const hasLegacyPlaceTags = await tableExists("restaurant_tags");
  const hasPlaceTags = await tableExists("place_tags");

  if (hasLegacyPlaceTags && hasPlaceTags) {
    console.error(
      "Legacy tag junction table and place_tags both exist. Resolve manually before migrating."
    );
    process.exit(1);
  }

  if (hasPlaces && !hasLegacyPlaces) {
    console.log("✅ Schema already uses places / place_id.");
    return;
  }

  if (!hasLegacyPlaces && !hasPlaces) {
    console.log("No places table found. Run npm run createPlacesTable first.");
    return;
  }

  if (hasLegacyPlaces && hasPlaces) {
    console.error("Legacy and new place tables both exist. Resolve manually before migrating.");
    process.exit(1);
  }

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'reviews_restaurant_id_fkey'
        ) THEN
          ALTER TABLE reviews DROP CONSTRAINT reviews_restaurant_id_fkey;
        END IF;
      END $$;
    `);

    if (hasLegacyPlaceTags) {
      await client.query(`
        ALTER TABLE restaurant_tags DROP CONSTRAINT IF EXISTS restaurant_tags_restaurant_id_fkey;
      `);
    }

    await client.query(`ALTER TABLE restaurants RENAME TO places`);

    await client.query(`ALTER TABLE reviews RENAME COLUMN restaurant_id TO place_id`);

    await client.query(`
      ALTER TABLE reviews ADD CONSTRAINT reviews_place_id_fkey
      FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE;
    `);

    if (hasLegacyPlaceTags && !hasPlaceTags) {
      await client.query(`ALTER TABLE restaurant_tags RENAME TO place_tags`);
      await client.query(
        `ALTER TABLE place_tags RENAME COLUMN restaurant_id TO place_id`
      );
      await client.query(`
        ALTER TABLE place_tags ADD CONSTRAINT place_tags_place_id_fkey
        FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE;
      `);
      await client.query(`
        DROP INDEX IF EXISTS idx_restaurant_tags_tag_id;
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_place_tags_tag_id ON place_tags (tag_id);
      `);
    }

    await client.query("COMMIT");
    console.log("✅ Migration complete: places, reviews.place_id, place_tags.");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error(rollbackErr);
    }
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    client.release();
  }
};

migrateToPlaces()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
