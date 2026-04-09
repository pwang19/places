/** Inclusive bounds for `places.price_range` (nullable in DB = N/A). */
export const PRICE_RANGE_MIN = 1;
export const PRICE_RANGE_MAX = 5;

/** Review star rating bounds. */
export const RATING_MIN = 1;
export const RATING_MAX = 5;

/** Max length for reviewer display name / posting-as label. */
export const DISPLAY_NAME_MAX_LEN = 50;

export const PRICE_RANGE_INVALID_MESSAGE =
  "price_range must be an integer from 1 to 5, or omitted for not applicable";

export const RATING_INVALID_MESSAGE = "rating must be an integer from 1 to 5";

export function isValidPriceRangeInt(n: number): boolean {
  return (
    Number.isFinite(n) &&
    Number.isInteger(n) &&
    n >= PRICE_RANGE_MIN &&
    n <= PRICE_RANGE_MAX
  );
}

export function isValidRatingInt(n: number): boolean {
  return (
    Number.isFinite(n) &&
    Number.isInteger(n) &&
    n >= RATING_MIN &&
    n <= RATING_MAX
  );
}
