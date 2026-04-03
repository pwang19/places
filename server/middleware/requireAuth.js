const { COOKIE_NAME, verifySessionToken } = require("../services/sessionCookie");

function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  const payload = verifySessionToken(token);
  if (!payload || !payload.email || !payload.sub) {
    return res.status(401).json({ status: "Error", message: "Not authenticated" });
  }
  req.user = {
    sub: payload.sub,
    email: payload.email,
    name: payload.name || undefined,
  };
  next();
}

module.exports = requireAuth;
