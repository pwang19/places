const { OAuth2Client } = require("google-auth-library");

const clientId = process.env.GOOGLE_CLIENT_ID;
let oauth2Client;

function getClient() {
  if (!clientId) {
    const err = new Error("GOOGLE_CLIENT_ID is not configured");
    err.status = 503;
    throw err;
  }
  if (!oauth2Client) {
    oauth2Client = new OAuth2Client(clientId);
  }
  return oauth2Client;
}

/**
 * Verifies a Google ID token (JWT) from GIS / GoogleLogin.
 * @returns {Promise<{ sub: string, email: string, name?: string, email_verified: boolean, hd?: string }>}
 */
async function verifyGoogleIdToken(idToken) {
  if (!idToken || typeof idToken !== "string") {
    const err = new Error("Invalid credential");
    err.status = 400;
    throw err;
  }
  const client = getClient();
  const ticket = await client.verifyIdToken({
    idToken,
    audience: clientId,
  });
  return ticket.getPayload();
}

module.exports = { verifyGoogleIdToken };
