const crypto = require("crypto");

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_HEX_LENGTH = 64;

let cachedKey = null;

function getKeyBuffer() {
  if (cachedKey) return cachedKey;
  const hex = process.env.PRIVATE_NOTES_KEY;
  if (!hex || typeof hex !== "string" || hex.length !== KEY_HEX_LENGTH) {
    const err = new Error(
      "PRIVATE_NOTES_KEY must be set to 64 hex characters (32 bytes) for AES-256-GCM"
    );
    err.status = 500;
    throw err;
  }
  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    const err = new Error("PRIVATE_NOTES_KEY must contain only hexadecimal characters");
    err.status = 500;
    throw err;
  }
  cachedKey = Buffer.from(hex, "hex");
  if (cachedKey.length !== 32) {
    cachedKey = null;
    const err = new Error("PRIVATE_NOTES_KEY decodes to wrong length (expected 32 bytes)");
    err.status = 500;
    throw err;
  }
  return cachedKey;
}

/**
 * @param {string} plaintext
 * @returns {string} base64(iv || tag || ciphertext)
 */
function encrypt(plaintext) {
  const key = getKeyBuffer();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

/**
 * @param {string} stored base64(iv || tag || ciphertext)
 * @returns {string}
 */
function decrypt(stored) {
  const key = getKeyBuffer();
  const buf = Buffer.from(stored, "base64");
  if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    const err = new Error("Invalid encrypted note payload");
    err.status = 500;
    throw err;
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString("utf8");
}

module.exports = { encrypt, decrypt };
