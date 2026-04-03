-- for help     \?

-- list database        \l

-- Create database      CREATE DATABASE database_name

-- Connect to database      \c database_name

-- List all tables      \d

-- List details of specific table       \d table_name

-- PRACTICE SCHEMA
CREATE TABLE products (
    id INT,
    name VARCHAR(255),
    price INT,
    on_sale boolean
);

-- ADD TABLE
ALTER TABLE products ADD COLUMN featured boolean;
-- DROP TABLE
ALTER TABLE products DROP COLUMN featured;

---------------------

-- YELP DATABASE / TABLE

-- CREATE PLACES TABLE
CREATE TABLE places (
    id BIGSERIAL NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    price_range INT CHECK (price_range IS NULL OR (price_range >= 1 AND price_range <= 5))
);

-- INSERT INTO TABLE
INSERT INTO places (id, name, location, price_range) values (123, 'McDonalds', 'New York', 3);

-- CREATE TABLE REVIEWS
CREATE TABLE reviews (
    id BIGSERIAL NOT NULL PRIMARY KEY,
    place_id BIGINT NOT NULL REFERENCES places(id),
    name VARCHAR(50) NOT NULL,
    review TEXT NOT NULL,
    rating INT NOT NULL check(rating >=1 and rating <=5),
    user_sub VARCHAR(255) NULL
);

-- INSERT INTO REVIEWS
INSERT INTO reviews (place_id, name, review, rating) values (9, 'Eric', 'Place was splendid', 4);

-- Per-user private notes (ciphertext only; see server env PRIVATE_NOTES_KEY)
CREATE TABLE place_private_notes (
    id BIGSERIAL NOT NULL PRIMARY KEY,
    place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    user_sub VARCHAR(255) NOT NULL,
    note_ciphertext TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(place_id, user_sub)
);
CREATE INDEX idx_place_private_notes_place_user ON place_private_notes(place_id, user_sub);
