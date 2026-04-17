import { DISPLAY_NAME_MAX_LEN } from "@places/shared";

/** Display label for the signed-in user (aligned with posting name in reviews). */
export function postingAsLabel(user) {
  if (!user) return "Member";
  const rawName = user.name != null ? String(user.name).trim() : "";
  if (rawName) return rawName.slice(0, DISPLAY_NAME_MAX_LEN);
  const email = user.email ? String(user.email) : "";
  if (email) {
    const local = email.split("@")[0];
    if (local && local.trim()) return local.trim().slice(0, DISPLAY_NAME_MAX_LEN);
  }
  return "Member";
}
