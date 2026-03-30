/**
 * Normalizes place.tags from the API (array or JSON string) to an array.
 */
export function normalizeTags(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
