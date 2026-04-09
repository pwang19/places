const { DISPLAY_NAME_MAX_LEN } = require("@places/shared");

/** Display name for reviews / UI (mirrors client postingAsLabel). */
function displayNameFromUser(user) {
  const rawName = user && user.name != null ? String(user.name).trim() : "";
  if (rawName) return rawName.slice(0, DISPLAY_NAME_MAX_LEN);
  const email = user && user.email ? String(user.email) : "";
  if (email) {
    const local = email.split("@")[0];
    if (local && local.trim()) return local.trim().slice(0, DISPLAY_NAME_MAX_LEN);
  }
  return "Member";
}

module.exports = { displayNameFromUser };
