const express = require("express");
const rateLimit = require("express-rate-limit");
const asyncHandler = require("../middleware/asyncHandler");
const { verifyGoogleIdToken } = require("../services/verifyGoogleIdToken");
const {
  COOKIE_NAME,
  signSessionPayload,
  sessionCookieOptions,
  verifySessionToken,
} = require("../services/sessionCookie");

const router = express.Router();

const googleLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

function allowedEmailDomains() {
  const raw = process.env.ALLOWED_EMAIL_DOMAIN || "acts2.network";
  return raw
    .toLowerCase()
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
}

function isAllowedDomain(email) {
  if (!email || typeof email !== "string") return false;
  const lower = email.toLowerCase();
  return allowedEmailDomains().some((domain) => lower.endsWith(`@${domain}`));
}

function allowedDomainsMessage() {
  const domains = allowedEmailDomains();
  return domains.map((d) => `@${d}`).join(" or ");
}

router.post(
  "/google",
  googleLoginLimiter,
  asyncHandler(async (req, res) => {
    const idToken = req.body && req.body.credential;
    let payload;
    try {
      payload = await verifyGoogleIdToken(idToken);
    } catch (e) {
      if (e.status === 400 || e.status === 503) throw e;
      const err = new Error("Google sign-in failed");
      err.status = 401;
      throw err;
    }
    if (!payload.email_verified) {
      return res.status(403).json({
        status: "Error",
        message: "Google account email is not verified",
      });
    }
    if (!isAllowedDomain(payload.email)) {
      return res.status(403).json({
        status: "Error",
        message: `Only ${allowedDomainsMessage()} accounts may sign in`,
      });
    }
    const token = signSessionPayload({
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
    });
    res.cookie(COOKIE_NAME, token, sessionCookieOptions());
    res.status(200).json({
      status: "Success",
      data: {
        user: {
          sub: payload.sub,
          email: payload.email,
          name: payload.name || undefined,
        },
      },
    });
  })
);

router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  res.status(200).json({ status: "Success", message: "Signed out" });
});

router.get("/me", (req, res) => {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  const payload = verifySessionToken(token);
  if (!payload || !payload.email || !payload.sub) {
    return res.status(401).json({ status: "Error", message: "Not authenticated" });
  }
  res.status(200).json({
    status: "Success",
    data: {
      user: {
        sub: payload.sub,
        email: payload.email,
        name: payload.name || undefined,
      },
    },
  });
});

module.exports = router;
