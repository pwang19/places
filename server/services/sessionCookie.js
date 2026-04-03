const jwt = require("jsonwebtoken");

const COOKIE_NAME = "places_session";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    const err = new Error("SESSION_SECRET is not configured");
    err.status = 503;
    throw err;
  }
  return secret;
}

function signSessionPayload(payload) {
  return jwt.sign(
    {
      sub: payload.sub,
      email: payload.email,
      name: payload.name || "",
    },
    getSecret(),
    { expiresIn: Math.floor(MAX_AGE_MS / 1000), algorithm: "HS256" }
  );
}

function verifySessionToken(token) {
  if (!token || typeof token !== "string") return null;
  try {
    return jwt.verify(token, getSecret(), { algorithms: ["HS256"] });
  } catch {
    return null;
  }
}

function sessionCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: MAX_AGE_MS,
    path: "/",
  };
}

module.exports = {
  COOKIE_NAME,
  signSessionPayload,
  verifySessionToken,
  sessionCookieOptions,
};
