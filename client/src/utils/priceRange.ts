import { isValidPriceRangeInt } from "@places/shared";

/**
 * Returns a display string like "$$" for numeric 1–5, or null if N/A / invalid.
 */
export function formatPriceRangeDollars(priceRange) {
  if (priceRange == null || priceRange === "") return null;
  const n = Number(priceRange);
  if (!isValidPriceRangeInt(n)) return null;
  return "$".repeat(n);
}
