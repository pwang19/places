/** Non-empty trimmed strings from a place contact list field (DB or JSON). */
export function cleanStringList(v) {
  if (!Array.isArray(v)) return [];
  return v.map((s) => String(s).trim()).filter(Boolean);
}

/** Absolute URL for opening a user-entered website in a new tab. */
export function websiteHref(raw) {
  const t = String(raw).trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}
