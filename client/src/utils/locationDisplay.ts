/**
 * Prefer "City, State/Province" from a comma-separated address (US street lines,
 * or Canadian lines ending in ", Canada" with optional postal on province segment).
 */
const TRAILING_COUNTRY = /^(canada|usa|united states of america|united states)$/i;

/** Remove Canadian postal code (e.g. "V5V 3N9") from end of "BC V5V 3N9". */
function stripCanadianPostal(segment: string): string {
  return segment
    .replace(/\s+[A-Z]\d[A-Z]\s*\d[A-Z]\d\s*$/i, "")
    .trim();
}

function stripUsZip(segment: string): string {
  return segment.replace(/\s+\d{5}(-\d{4})?\s*$/i, "").trim();
}

export function cityStateFromLocation(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const parts = s
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return s;

  const last = parts[parts.length - 1]!;

  if (TRAILING_COUNTRY.test(last)) {
    const country = last;
    if (parts.length >= 4) {
      const city = parts[parts.length - 3]!;
      let region = parts[parts.length - 2]!;
      region = /canada/i.test(country)
        ? stripCanadianPostal(region)
        : stripUsZip(region);
      const combined = `${city}, ${region}`.trim();
      return combined || s;
    }
    if (parts.length === 3) {
      const city = parts[0]!;
      let region = parts[1]!;
      region = /canada/i.test(country)
        ? stripCanadianPostal(region)
        : stripUsZip(region);
      const combined = `${city}, ${region}`.trim();
      return combined || s;
    }
    return s;
  }

  const city = parts[parts.length - 2]!;
  let region = parts[parts.length - 1]!;
  region = stripUsZip(region);
  const combined = `${city}, ${region}`.trim();
  return combined || s;
}
