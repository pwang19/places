/**
 * Returns a display string like "$$" for numeric 1–5, or null if N/A / invalid.
 */
export function formatPriceRangeDollars(priceRange) {
  if (priceRange == null || priceRange === "") return null;
  const n = Number(priceRange);
  if (!Number.isFinite(n) || n < 1 || n > 5 || !Number.isInteger(n)) {
    return null;
  }
  return "$".repeat(n);
}
