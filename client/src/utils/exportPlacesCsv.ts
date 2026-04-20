import { normalizeTags } from "./tags";
import { formatPriceRangeDollars } from "./priceRange";
import { cleanStringList } from "./contactInfo";

export const EXPORT_OPTIONAL_FIELD_IDS = [
  "notes",
  "price",
  "rating",
  "tags",
  "phone",
  "emails",
  "websites",
] as const;

export type ExportOptionalFieldId = (typeof EXPORT_OPTIONAL_FIELD_IDS)[number];

function escapeCsvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowToCsvLine(cells: string[]): string {
  return cells.map(escapeCsvCell).join(",");
}

function ratingExportText(place: Record<string, unknown>): string {
  if (place.reviews_disabled) return "—";
  const count = Number(place.count) || 0;
  if (!count) return "No reviews";
  const parsed =
    place.average_rating != null ? parseFloat(String(place.average_rating)) : 0;
  const avg = Number.isFinite(parsed) ? parsed : 0;
  return `${avg} (${count})`;
}

function tagsExportText(place: Record<string, unknown>): string {
  const tags = normalizeTags(place.tags);
  return tags.map((t) => String(t.name || "").trim()).filter(Boolean).join(", ");
}

export function buildPlacesCsvLines(
  places: Record<string, unknown>[],
  optional: Set<ExportOptionalFieldId>
): string[] {
  const header: string[] = ["Place name", "Location"];
  if (optional.has("notes")) header.push("Public notes");
  if (optional.has("price")) header.push("Price");
  if (optional.has("rating")) header.push("Rating");
  if (optional.has("tags")) header.push("Tags");
  if (optional.has("phone")) header.push("Phone");
  if (optional.has("emails")) header.push("Emails");
  if (optional.has("websites")) header.push("Websites");

  const lines: string[] = [rowToCsvLine(header)];

  for (const place of places) {
    const cells: string[] = [
      String(place.name ?? ""),
      String(place.location ?? ""),
    ];
    if (optional.has("notes")) {
      cells.push(String(place.notes ?? ""));
    }
    if (optional.has("price")) {
      cells.push(formatPriceRangeDollars(place.price_range) || "");
    }
    if (optional.has("rating")) {
      cells.push(ratingExportText(place));
    }
    if (optional.has("tags")) {
      cells.push(tagsExportText(place));
    }
    if (optional.has("phone")) {
      cells.push(
        place.phone != null && String(place.phone).trim()
          ? String(place.phone).trim()
          : ""
      );
    }
    if (optional.has("emails")) {
      cells.push(cleanStringList(place.emails).join("; "));
    }
    if (optional.has("websites")) {
      cells.push(cleanStringList(place.websites).join("; "));
    }
    lines.push(rowToCsvLine(cells));
  }

  return lines;
}

export function downloadPlacesCsv(
  places: Record<string, unknown>[],
  optional: Set<ExportOptionalFieldId>
): void {
  const lines = buildPlacesCsvLines(places, optional);
  const csv = lines.join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `places-${stamp}.csv`;
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
