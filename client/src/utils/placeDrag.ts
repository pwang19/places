export const PLACE_DRAG_MIME = "application/x-places-place+v1";

/**
 * @param {DataTransfer} dataTransfer
 * @param {{ kind: string, source?: string, id: number, name?: string, location?: string, price_range?: number|null, listId?: number }} payload
 */
export function setPlaceDragData(dataTransfer, payload) {
  const s = JSON.stringify({ kind: "place", ...payload });
  try {
    dataTransfer.setData(PLACE_DRAG_MIME, s);
  } catch {
    /* Safari */
  }
  dataTransfer.setData("text/plain", s);
}

/**
 * @param {DataTransfer} dataTransfer
 * @returns {{ kind: string, source?: string, id: number, name?: string, location?: string, price_range?: number|null, listId?: number } | null}
 */
export function readPlaceDragData(dataTransfer) {
  let raw = "";
  try {
    raw = dataTransfer.getData(PLACE_DRAG_MIME);
  } catch {
    raw = "";
  }
  if (!raw) raw = dataTransfer.getData("text/plain");
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (o && o.kind === "place" && o.id != null) {
      return { ...o, id: Number(o.id) };
    }
  } catch {
    return null;
  }
  return null;
}
