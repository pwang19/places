import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import PlaceFinder, { listPlaceListsPicker } from "../../api/placesApi";
import { usePlacesContext } from "../../context/PlacesContext";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import StarRating from "../../components/ui/StarRating";
import TagInput from "../tags/TagInput";
import { normalizeTags } from "../../utils/tags";
import { formatPriceRangeDollars } from "../../utils/priceRange";
import { cityStateFromLocation } from "../../utils/locationDisplay";
import { setPlaceDragData } from "../../utils/placeDrag";

const LIST_VIEW_STORAGE_KEY = "places-list-view-mode";

function readStoredListView() {
  try {
    const v = localStorage.getItem(LIST_VIEW_STORAGE_KEY);
    if (v === "column" || v === "tile") return v;
  } catch {
    /* ignore */
  }
  return "column";
}

function tagsSortKey(place) {
  const names = normalizeTags(place.tags)
    .map((t) => String(t.name || "").trim().toLowerCase())
    .filter(Boolean)
    .sort();
  return names.length ? names.join("\u0001") : "\uffff";
}

const PLACES_COL_WIDTHS_KEY = "places-table-col-weights";
const COL_COUNT = 7;
const DEFAULT_COL_WEIGHTS = [0.05, 0.15, 0.2, 0.17, 0.09, 0.12, 0.22];
const MIN_COL_FR = [0.035, 0.07, 0.09, 0.07, 0.05, 0.07, 0.09];

function normalizeColWeights(w) {
  const s = w.reduce((a, b) => a + b, 0);
  if (s <= 0) return [...DEFAULT_COL_WEIGHTS];
  return w.map((x) => x / s);
}

function readStoredColWeights() {
  try {
    const raw = localStorage.getItem(PLACES_COL_WIDTHS_KEY);
    if (!raw) return normalizeColWeights(DEFAULT_COL_WEIGHTS);
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length !== COL_COUNT) {
      return normalizeColWeights(DEFAULT_COL_WEIGHTS);
    }
    const nums = arr.map((x) => Number(x));
    if (nums.some((n) => !Number.isFinite(n) || n <= 0)) {
      return normalizeColWeights(DEFAULT_COL_WEIGHTS);
    }
    return normalizeColWeights(nums);
  } catch {
    return normalizeColWeights(DEFAULT_COL_WEIGHTS);
  }
}

const PLACE_LIST_SORT_SPEC = [
  { key: "name", label: "Place name" },
  { key: "location", label: "Location" },
  { key: "price_range", label: "Price" },
  { key: "ratings", label: "Rating" },
  { key: "tags", label: "Tags" },
];

const PLACE_TABLE_HEADER_SPEC = [
  { role: "drag" },
  { role: "sort", sortKey: "name", label: "Place name" },
  { role: "sort", sortKey: "notes", label: "Public notes" },
  { role: "sort", sortKey: "location", label: "Location" },
  { role: "sort", sortKey: "price_range", label: "Price" },
  { role: "sort", sortKey: "ratings", label: "Rating" },
  { role: "sort", sortKey: "tags", label: "Tags" },
];

const PlaceList = (props) => {
  const { places, setPlaces } = usePlacesContext();
  const { isAdmin } = useAuth();
  let navigate = useNavigate(); // useNavigate function to navigate to place details page
  const [listViewMode, setListViewMode] = useState(readStoredListView);
  const [sortColumn, setSortColumn] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc"); // 'asc' or 'desc'
  const [activeFilterTags, setActiveFilterTags] = useState([]);
  const [activeListIds, setActiveListIds] = useState([]);
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [placeLists, setPlaceLists] = useState([]);
  const [nameSearchOpen, setNameSearchOpen] = useState(false);
  const [nameSearchInput, setNameSearchInput] = useState("");
  const [nameSearchApplied, setNameSearchApplied] = useState("");
  const nameSearchInputRef = useRef(null);
  const filtersWrapRef = useRef(null);
  const tableWrapRef = useRef(null);
  const [colWeights, setColWeights] = useState(readStoredColWeights);
  const latestWeightsRef = useRef(colWeights);
  const resizeSessionRef = useRef(null);
  const colWeightsRef = useRef(colWeights);
  colWeightsRef.current = colWeights;

  const [colMenuKey, setColMenuKey] = useState(null);
  const colMenuRef = useRef(null);
  const [colFilterName, setColFilterName] = useState("");
  const [colFilterNotes, setColFilterNotes] = useState("");
  const [colFilterLocation, setColFilterLocation] = useState("");
  const [colFilterPrices, setColFilterPrices] = useState([]);
  const [colFilterRating, setColFilterRating] = useState(null);

  useEffect(() => {
    latestWeightsRef.current = colWeights;
  }, [colWeights]);

  useEffect(() => {
    const onMove = (e) => {
      const sess = resizeSessionRef.current;
      if (!sess || !tableWrapRef.current) return;
      const wEl = tableWrapRef.current.offsetWidth;
      if (wEl < 40) return;
      const deltaFr = (e.clientX - sess.startX) / wEl;
      const i = sess.boundaryIndex;
      const sw = sess.startWeights;
      const minA = MIN_COL_FR[i];
      const minB = MIN_COL_FR[i + 1];
      let na = sw[i] + deltaFr;
      let nb = sw[i + 1] - deltaFr;
      if (na < minA) {
        na = minA;
        nb = sw[i] + sw[i + 1] - minA;
      } else if (nb < minB) {
        nb = minB;
        na = sw[i] + sw[i + 1] - minB;
      }
      if (na < minA || nb < minB) return;
      const next = [...sw];
      next[i] = na;
      next[i + 1] = nb;
      latestWeightsRef.current = next;
      setColWeights(next);
    };
    const onUp = () => {
      if (!resizeSessionRef.current) return;
      resizeSessionRef.current = null;
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
      try {
        localStorage.setItem(
          PLACES_COL_WIDTHS_KEY,
          JSON.stringify(latestWeightsRef.current)
        );
      } catch {
        /* ignore */
      }
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  const handleColResizeStart = useCallback((e, boundaryIndex) => {
    e.preventDefault();
    e.stopPropagation();
    resizeSessionRef.current = {
      boundaryIndex,
      startX: e.clientX,
      startWeights: [...colWeightsRef.current],
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    if (!isAdmin && showFlaggedOnly) {
      setShowFlaggedOnly(false);
    }
  }, [isAdmin, showFlaggedOnly]);

  useEffect(() => {
    try {
      localStorage.setItem(LIST_VIEW_STORAGE_KEY, listViewMode);
    } catch {
      /* ignore */
    }
  }, [listViewMode]);

  useEffect(() => {
    if (listViewMode !== "column") return;
    setNameSearchApplied("");
    setNameSearchInput("");
    setNameSearchOpen(false);
  }, [listViewMode]);

  const loadPlaces = useCallback(
    async (tagsArray, listIdsArray, flaggedOnly) => {
      try {
        const tagList = Array.isArray(tagsArray) ? tagsArray : [];
        const listList = Array.isArray(listIdsArray) ? listIdsArray : [];
        const response = await PlaceFinder.get("/", {
          params: {
            ...(tagList.length > 0 ? { tag: tagList } : {}),
            ...(listList.length > 0 ? { list: listList } : {}),
            ...(flaggedOnly ? { flaggedOnly: true } : {}),
          },
          paramsSerializer: {
            serialize: (params) => {
              const parts = [];
              const rawTag = params.tag;
              if (rawTag != null && rawTag !== "") {
                const arr = Array.isArray(rawTag) ? rawTag : [rawTag];
                arr.forEach((t) =>
                  parts.push(`tag=${encodeURIComponent(String(t))}`)
                );
              }
              const rawList = params.list;
              if (rawList != null && rawList !== "") {
                const arr = Array.isArray(rawList) ? rawList : [rawList];
                arr.forEach((id) =>
                  parts.push(`list=${encodeURIComponent(String(id))}`)
                );
              }
              return parts.join("&");
            },
          },
        });
        setPlaces(response.data.data.places);
      } catch (err) {
        console.log(err);
      }
    },
    [setPlaces]
  );

  useEffect(() => {
    loadPlaces(
      activeFilterTags,
      activeListIds,
      isAdmin && showFlaggedOnly
    );
  }, [activeFilterTags, activeListIds, loadPlaces, isAdmin, showFlaggedOnly]);

  const refreshPlaceLists = useCallback(async () => {
    try {
      const rows = await listPlaceListsPicker();
      setPlaceLists(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.log(err);
      setPlaceLists([]);
    }
  }, []);

  useEffect(() => {
    refreshPlaceLists();
  }, [refreshPlaceLists]);

  useEffect(() => {
    if (filtersOpen) {
      refreshPlaceLists();
    }
  }, [filtersOpen, refreshPlaceLists]);

  useEffect(() => {
    if (!filtersOpen) return undefined;
    const onPointerDown = (e) => {
      if (
        filtersWrapRef.current &&
        !filtersWrapRef.current.contains(e.target)
      ) {
        setFiltersOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setFiltersOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [filtersOpen]);

  useEffect(() => {
    if (colMenuKey == null) return undefined;
    const onDocMouseDown = (e) => {
      if (colMenuRef.current?.contains(e.target)) return;
      if (e.target.closest?.(".place-tiles-col-sort-btn")) return;
      setColMenuKey(null);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setColMenuKey(null);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [colMenuKey]);

  const listNameById = useMemo(() => {
    const m = new Map();
    placeLists.forEach((row) => {
      if (row && row.id != null) {
        m.set(Number(row.id), String(row.name || "").trim() || `#${row.id}`);
      }
    });
    return m;
  }, [placeLists]);

  const toggleListFilter = useCallback((listId) => {
    setActiveListIds((prev) =>
      prev.includes(listId)
        ? prev.filter((x) => x !== listId)
        : [...prev, listId]
    );
  }, []);

  const handlePlaceSelect = (id) => {
    navigate(`/places/${id}`);
  };

  const handleSortClick = (e, column) => {
    e.stopPropagation();
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const applyColumnSort = useCallback((column, direction) => {
    setSortColumn(column);
    setSortDirection(direction);
    setColMenuKey(null);
  }, []);

  const clearColumnFilter = useCallback((sortKey) => {
    switch (sortKey) {
      case "name":
        setColFilterName("");
        break;
      case "notes":
        setColFilterNotes("");
        break;
      case "location":
        setColFilterLocation("");
        break;
      case "price_range":
        setColFilterPrices([]);
        break;
      case "ratings":
        setColFilterRating(null);
        break;
      case "tags":
        setActiveFilterTags([]);
        break;
      default:
        break;
    }
  }, []);

  const toggleColPriceLevel = useCallback((n) => {
    setColFilterPrices((prev) =>
      prev.includes(n)
        ? prev.filter((x) => x !== n)
        : [...prev, n].sort((a, b) => a - b)
    );
  }, []);

  const headerHasColFilter = useCallback(
    (sortKey) => {
      switch (sortKey) {
        case "name":
          return colFilterName.trim() !== "";
        case "notes":
          return colFilterNotes.trim() !== "";
        case "location":
          return colFilterLocation.trim() !== "";
        case "price_range":
          return colFilterPrices.length > 0;
        case "ratings":
          return colFilterRating != null;
        case "tags":
          return activeFilterTags.length > 0;
        default:
          return false;
      }
    },
    [
      colFilterName,
      colFilterNotes,
      colFilterLocation,
      colFilterPrices,
      colFilterRating,
      activeFilterTags,
    ]
  );

  const columnClientFiltersActive = useMemo(
    () =>
      colFilterName.trim() !== "" ||
      colFilterNotes.trim() !== "" ||
      colFilterLocation.trim() !== "" ||
      colFilterPrices.length > 0 ||
      colFilterRating != null,
    [
      colFilterName,
      colFilterNotes,
      colFilterLocation,
      colFilterPrices,
      colFilterRating,
    ]
  );

  // Sort places based on current sort column and direction
  const sortedPlaces = useMemo(() => {
    if (!sortColumn || !places) return places;

    return [...places].sort((a, b) => {
      let aValue, bValue;

      switch (sortColumn) {
        case 'name':
          aValue = (a.name || '').toLowerCase();
          bValue = (b.name || '').toLowerCase();
          break;
        case 'price_range':
          // Null / N/A sorts after $–$$$$$ when ascending
          aValue =
            a.price_range != null && a.price_range !== ""
              ? Number(a.price_range)
              : Number.POSITIVE_INFINITY;
          bValue =
            b.price_range != null && b.price_range !== ""
              ? Number(b.price_range)
              : Number.POSITIVE_INFINITY;
          break;
        case 'ratings':
          // Sort by average rating (null/undefined treated as 0 for places with no reviews)
          aValue = a.average_rating != null ? parseFloat(a.average_rating) : 0;
          bValue = b.average_rating != null ? parseFloat(b.average_rating) : 0;
          break;
        case 'location':
          aValue = (a.location || "").toLowerCase();
          bValue = (b.location || "").toLowerCase();
          break;
        case 'notes':
          aValue = (a.notes || "").toLowerCase();
          bValue = (b.notes || "").toLowerCase();
          break;
        case 'tags':
          aValue = tagsSortKey(a);
          bValue = tagsSortKey(b);
          break;
        default:
          return 0;
      }

      // Compare values
      let comparison = 0;
      if (aValue < bValue) {
        comparison = -1;
      } else if (aValue > bValue) {
        comparison = 1;
      }

      // Reverse if descending
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [places, sortColumn, sortDirection]);

  const displayPlaces = useMemo(() => {
    if (!sortedPlaces) return sortedPlaces;
    let rows = sortedPlaces;
    const q = nameSearchApplied.trim().toLowerCase();
    if (listViewMode === "tile" && q) {
      rows = rows.filter((p) =>
        (p.name || "").toLowerCase().includes(q)
      );
    }
    if (listViewMode !== "column") return rows;
    const nf = colFilterName.trim().toLowerCase();
    if (nf) {
      rows = rows.filter((p) =>
        (p.name || "").toLowerCase().includes(nf)
      );
    }
    const nxf = colFilterNotes.trim().toLowerCase();
    if (nxf) {
      rows = rows.filter((p) =>
        (p.notes || "").toLowerCase().includes(nxf)
      );
    }
    const lf = colFilterLocation.trim().toLowerCase();
    if (lf) {
      rows = rows.filter((p) =>
        (p.location || "").toLowerCase().includes(lf)
      );
    }
    if (colFilterPrices.length > 0) {
      const priceSet = new Set(colFilterPrices);
      rows = rows.filter((p) => {
        const pr = p.price_range;
        if (pr == null || pr === "") return false;
        return priceSet.has(Number(pr));
      });
    }
    if (colFilterRating != null) {
      rows = rows.filter((p) => {
        if (p.reviews_disabled) return false;
        if (!p.count) return false;
        const avg = parseFloat(p.average_rating);
        if (!Number.isFinite(avg)) return false;
        return Math.round(avg) === colFilterRating;
      });
    }
    return rows;
  }, [
    sortedPlaces,
    nameSearchApplied,
    listViewMode,
    colFilterName,
    colFilterNotes,
    colFilterLocation,
    colFilterPrices,
    colFilterRating,
  ]);

  const emptyPlacesMessage = useMemo(() => {
    if (
      sortedPlaces &&
      sortedPlaces.length > 0 &&
      listViewMode === "tile" &&
      nameSearchApplied.trim()
    ) {
      return "No places match that name.";
    }
    if (
      sortedPlaces &&
      sortedPlaces.length > 0 &&
      listViewMode === "column" &&
      columnClientFiltersActive
    ) {
      return "No places match these column filters.";
    }
    if (activeFilterTags.length > 0 || activeListIds.length > 0) {
      return "No places match these filters.";
    }
    if (isAdmin && showFlaggedOnly) {
      return "No flagged places.";
    }
    return "No places to show.";
  }, [
    sortedPlaces,
    nameSearchApplied,
    listViewMode,
    columnClientFiltersActive,
    activeFilterTags.length,
    activeListIds.length,
    isAdmin,
    showFlaggedOnly,
    listViewMode,
  ]);

  useEffect(() => {
    if (nameSearchOpen && nameSearchInputRef.current) {
      nameSearchInputRef.current.focus();
    }
  }, [nameSearchOpen]);

  const sortLabels = {
    name: "Name",
    price_range: "Price",
    ratings: "Rating",
  };

  const getSortIcon = (column) => {
    if (sortColumn !== column) {
      return <span className="place-tiles-sort-icon" aria-hidden>↕</span>;
    }
    return (
      <span className="place-tiles-sort-icon place-tiles-sort-icon--active" aria-hidden>
        {sortDirection === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  const renderRating = (place) => {
    if (!place.count) {
      return <span style={{ color: "var(--text-muted)" }}>No reviews yet</span>;
    }
    const parsed =
      place.average_rating != null ? parseFloat(place.average_rating) : 0;
    const avg = Number.isFinite(parsed) ? parsed : 0;
    return (
      <>
        <StarRating rating={avg} />
        <span style={{ color: "var(--text-muted)" }}>({place.count})</span>
      </>
    );
  };

  const renderColumnFilterControls = (sortKey) => {
    const clearBtn = (
      <button
        type="button"
        className="btn btn-link btn-sm p-0 place-tiles-col-filter-clear"
        onClick={() => clearColumnFilter(sortKey)}
      >
        Clear filter
      </button>
    );
    switch (sortKey) {
      case "name":
        return (
          <div className="place-tiles-col-filter-field">
            <label className="form-label small mb-1" htmlFor="col-filter-name">
              Name contains
            </label>
            <input
              id="col-filter-name"
              type="search"
              className="form-control form-control-sm"
              value={colFilterName}
              onChange={(e) => setColFilterName(e.target.value)}
              placeholder="Substring…"
              autoComplete="off"
            />
            {clearBtn}
          </div>
        );
      case "notes":
        return (
          <div className="place-tiles-col-filter-field">
            <label className="form-label small mb-1" htmlFor="col-filter-notes">
              Notes contain
            </label>
            <input
              id="col-filter-notes"
              type="search"
              className="form-control form-control-sm"
              value={colFilterNotes}
              onChange={(e) => setColFilterNotes(e.target.value)}
              placeholder="Substring…"
              autoComplete="off"
            />
            {clearBtn}
          </div>
        );
      case "location":
        return (
          <div className="place-tiles-col-filter-field">
            <label
              className="form-label small mb-1"
              htmlFor="col-filter-location"
            >
              Location contains
            </label>
            <input
              id="col-filter-location"
              type="search"
              className="form-control form-control-sm"
              value={colFilterLocation}
              onChange={(e) => setColFilterLocation(e.target.value)}
              placeholder="Substring…"
              autoComplete="off"
            />
            {clearBtn}
          </div>
        );
      case "price_range":
        return (
          <div className="place-tiles-col-filter-field">
            <span className="form-label small mb-1 d-block">Price ($)</span>
            <div className="place-tiles-col-filter-price-row d-flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <label
                  key={n}
                  className="place-tiles-col-filter-price-opt small mb-0"
                >
                  <input
                    type="checkbox"
                    checked={colFilterPrices.includes(n)}
                    onChange={() => toggleColPriceLevel(n)}
                  />{" "}
                  {"$".repeat(n)}
                </label>
              ))}
            </div>
            {clearBtn}
          </div>
        );
      case "ratings":
        return (
          <div className="place-tiles-col-filter-field">
            <span className="form-label small mb-1 d-block">Average stars</span>
            <div className="d-flex flex-wrap gap-1 align-items-center">
              <label className="small mb-0 me-2">
                <input
                  type="radio"
                  className="me-1"
                  name="col-filter-rating"
                  checked={colFilterRating == null}
                  onChange={() => setColFilterRating(null)}
                />
                Any
              </label>
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="small mb-0 me-1">
                  <input
                    type="radio"
                    className="me-1"
                    name="col-filter-rating"
                    checked={colFilterRating === n}
                    onChange={() => setColFilterRating(n)}
                  />
                  {n}★
                </label>
              ))}
            </div>
            {clearBtn}
          </div>
        );
      case "tags":
        return (
          <div className="place-tiles-col-filter-field">
            <p className="small text-muted mb-2">
              Match <strong>all</strong> of these tags (same as tag filter).
            </p>
            <div className="place-tiles-filter-input-wrap place-tiles-filter-input-wrap--panel mb-2">
              <TagInput
                id="place-col-menu-tag-filter"
                placeholder="Add tag, press Enter"
                showHint={false}
                onSubmitName={async (name) => {
                  const trimmed = String(name).trim();
                  if (!trimmed) return;
                  setActiveFilterTags((prev) => {
                    if (
                      prev.some(
                        (t) => t.toLowerCase() === trimmed.toLowerCase()
                      )
                    ) {
                      return prev;
                    }
                    return [...prev, trimmed];
                  });
                }}
              />
            </div>
            {activeFilterTags.length > 0 ? (
              <div className="place-tiles-filters-pills mb-2">
                {activeFilterTags.map((tag) => (
                  <span
                    key={tag}
                    className="place-tiles-tag-filter-pill"
                  >
                    <span className="place-tiles-tag-filter-pill-text">
                      {tag}
                    </span>
                    <button
                      type="button"
                      className="place-tiles-tag-filter-pill-remove"
                      title={`Remove filter “${tag}”`}
                      aria-label={`Remove tag filter ${tag}`}
                      onClick={() =>
                        setActiveFilterTags((prev) =>
                          prev.filter((t) => t !== tag)
                        )
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            {clearBtn}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <div className="modern-table-container place-tiles-root">
        <div className="place-tiles-toolbar">
          <div
            className="place-tiles-sort-bar"
            role="toolbar"
            aria-label="Sort and filter places"
          >
            <div className="place-tiles-sort-bar-main">
              <div
                className="place-tiles-view-toggle"
                role="group"
                aria-label="Places list layout"
              >
                <button
                  type="button"
                  className={`place-tiles-view-btn${listViewMode === "column" ? " is-active" : ""}`}
                  aria-pressed={listViewMode === "column"}
                  onClick={() => setListViewMode("column")}
                >
                  <i className="fas fa-columns" aria-hidden />
                  Columns
                </button>
                <button
                  type="button"
                  className={`place-tiles-view-btn${listViewMode === "tile" ? " is-active" : ""}`}
                  aria-pressed={listViewMode === "tile"}
                  onClick={() => setListViewMode("tile")}
                >
                  <i className="fas fa-th-large" aria-hidden />
                  Tiles
                </button>
              </div>
              {listViewMode === "tile" ? (
                <>
                  <span className="place-tiles-sort-label">Sort by</span>
                  {["name", "price_range", "ratings"].map((column) => (
                    <button
                      key={column}
                      type="button"
                      className={`place-tiles-sort-btn${sortColumn === column ? " is-active" : ""}`}
                      onClick={(e) => handleSortClick(e, column)}
                    >
                      {sortLabels[column]}
                      {getSortIcon(column)}
                    </button>
                  ))}
                </>
              ) : null}
              <div
                className="place-tiles-filters-wrap place-tiles-filter-section-start"
                ref={filtersWrapRef}
              >
                <button
                  type="button"
                  className={`place-tiles-filters-trigger${activeFilterTags.length > 0 || activeListIds.length > 0 || (listViewMode === "column" && columnClientFiltersActive) ? " has-active-filters" : ""}`}
                  aria-expanded={filtersOpen}
                  aria-haspopup="dialog"
                  aria-controls="place-list-filters-panel"
                  onClick={() => setFiltersOpen((open) => !open)}
                >
                  <i className="fas fa-sliders-h" aria-hidden />
                  <span>Filters</span>
                  {activeFilterTags.length + activeListIds.length > 0 ? (
                    <span className="place-tiles-filters-count">
                      {activeFilterTags.length + activeListIds.length}
                    </span>
                  ) : null}
                </button>
                {filtersOpen ? (
                  <div
                    id="place-list-filters-panel"
                    className="place-tiles-filters-panel"
                    role="dialog"
                    aria-label={
                      listViewMode === "column"
                        ? "Filter places by lists"
                        : "Filter places by tags and lists"
                    }
                  >
                    <div className="place-tiles-filters-panel-body">
                      {listViewMode !== "column" ? (
                        <div className="place-tiles-filters-section">
                          <h3
                            className="place-tiles-filters-section-title"
                            id="place-list-tags-heading"
                          >
                            Tags
                          </h3>
                          <p className="place-tiles-filters-section-hint small text-muted mb-2">
                            A place must match <strong>all</strong> tags.
                          </p>
                          <div className="place-tiles-filter-input-wrap place-tiles-filter-input-wrap--panel">
                            <TagInput
                              id="place-list-tag-filter"
                              placeholder="Add tag, press Enter"
                              showHint={false}
                              aria-labelledby="place-list-tags-heading"
                              aria-describedby="place-list-filter-desc"
                              onSubmitName={async (name) => {
                                const trimmed = String(name).trim();
                                if (!trimmed) return;
                                setActiveFilterTags((prev) => {
                                  if (
                                    prev.some(
                                      (t) =>
                                        t.toLowerCase() ===
                                        trimmed.toLowerCase()
                                    )
                                  ) {
                                    return prev;
                                  }
                                  return [...prev, trimmed];
                                });
                              }}
                            />
                          </div>
                          {activeFilterTags.length > 0 ? (
                            <div className="place-tiles-filters-pills">
                              {activeFilterTags.map((tag) => (
                                <span
                                  key={tag}
                                  className="place-tiles-tag-filter-pill"
                                >
                                  <span className="place-tiles-tag-filter-pill-text">
                                    {tag}
                                  </span>
                                  <button
                                    type="button"
                                    className="place-tiles-tag-filter-pill-remove"
                                    title={`Remove filter “${tag}”`}
                                    aria-label={`Remove tag filter ${tag}`}
                                    onClick={() =>
                                      setActiveFilterTags((prev) =>
                                        prev.filter((t) => t !== tag)
                                      )
                                    }
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="place-tiles-filters-section">
                        <h3
                          className="place-tiles-filters-section-title"
                          id="place-list-lists-heading"
                        >
                          Lists
                        </h3>
                        <p className="place-tiles-filters-section-hint small text-muted mb-2">
                          Show places in <strong>any</strong> selected list.
                        </p>
                        {placeLists.length === 0 ? (
                          <p className="text-muted small mb-0">
                            No lists yet. Create one in the sidebar.
                          </p>
                        ) : (
                          <ul className="place-tiles-filters-list-checkboxes list-unstyled mb-0">
                            {placeLists.map((row) => {
                              const id = Number(row.id);
                              return (
                                <li key={id}>
                                  <label className="place-tiles-filters-list-option">
                                    <input
                                      type="checkbox"
                                      checked={activeListIds.includes(id)}
                                      onChange={() => toggleListFilter(id)}
                                    />
                                    <span>{row.name}</span>
                                    {row.is_public && !row.is_owner ? (
                                      <span className="text-muted small">
                                        {" "}
                                        · Public
                                      </span>
                                    ) : null}
                                  </label>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                      {isAdmin ? (
                        <div className="place-tiles-filters-section">
                          <h3
                            className="place-tiles-filters-section-title"
                            id="place-list-flagged-heading"
                          >
                            Admin
                          </h3>
                          <label className="place-tiles-filters-list-option d-block">
                            <input
                              type="checkbox"
                              checked={showFlaggedOnly}
                              onChange={() =>
                                setShowFlaggedOnly((v) => !v)
                              }
                            />
                            <span>Show flagged places only</span>
                          </label>
                        </div>
                      ) : null}
                    </div>
                    <div className="place-tiles-filters-panel-footer">
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => setFiltersOpen(false)}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            {listViewMode === "tile" ? (
              <div className="place-tiles-name-search">
                {!nameSearchOpen ? (
                  <button
                    type="button"
                    className={`place-tiles-name-search-toggle${nameSearchApplied.trim() ? " has-filter" : ""}`}
                    title={
                      nameSearchApplied.trim()
                        ? `Name filter: “${nameSearchApplied.trim()}”. Click to edit.`
                        : "Search by place name"
                    }
                    aria-label="Open place name search"
                    aria-expanded={false}
                    onClick={() => {
                      setNameSearchInput(nameSearchApplied);
                      setNameSearchOpen(true);
                    }}
                  >
                    <i className="fas fa-search" aria-hidden />
                  </button>
                ) : (
                  <div className="place-tiles-name-search-field">
                    <input
                      ref={nameSearchInputRef}
                      type="search"
                      className="form-control form-control-sm place-tiles-name-search-input"
                      placeholder="Place name…"
                      aria-label="Filter by place name, press Enter"
                      value={nameSearchInput}
                      onChange={(e) => {
                        const v = e.target.value;
                        setNameSearchInput(v);
                        if (!v.trim()) {
                          setNameSearchApplied("");
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const q = nameSearchInput.trim();
                          setNameSearchApplied(q);
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setNameSearchOpen(false);
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="place-tiles-name-search-close"
                      title="Close name search"
                      aria-label="Close name search"
                      onClick={() => setNameSearchOpen(false)}
                    >
                      <i className="fas fa-times" aria-hidden />
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
          <p
            id="place-list-filter-desc"
            className={`place-tiles-filter-hint text-muted small mb-0${
              activeFilterTags.length === 0 &&
              activeListIds.length === 0 &&
              !nameSearchApplied.trim() &&
              !(isAdmin && showFlaggedOnly) &&
              !(
                listViewMode === "column" &&
                columnClientFiltersActive
              )
                ? " visually-hidden"
                : ""
            }`}
          >
            {activeFilterTags.length > 0 || activeListIds.length > 0 ? (
              <>
                {isAdmin && showFlaggedOnly ? (
                  <>
                    Showing <strong>only flagged</strong> places
                  </>
                ) : (
                  "Showing places"
                )}
                {activeFilterTags.length > 0 ? (
                  <>
                    {" "}
                    that match <strong>all</strong> of these tags:{" "}
                    <span className="text-body">
                      {activeFilterTags.map((t) => `"${t}"`).join(", ")}
                    </span>
                  </>
                ) : null}
                {activeListIds.length > 0 ? (
                  <>
                    {activeFilterTags.length > 0 ? (
                      <> · and appear in </>
                    ) : (
                      <> in </>
                    )}
                    <strong>any</strong> of these lists:{" "}
                    <span className="text-body">
                      {activeListIds
                        .map(
                          (id) =>
                            listNameById.get(id) ?? `List #${id}`
                        )
                        .join(", ")}
                    </span>
                  </>
                ) : null}
                {listViewMode === "tile" && nameSearchApplied.trim() ? (
                  <>
                    {" "}
                    · Name contains{" "}
                    <span className="text-body">
                      &quot;{nameSearchApplied.trim()}&quot;
                    </span>
                  </>
                ) : null}
                .
              </>
            ) : listViewMode === "tile" && nameSearchApplied.trim() ? (
              <>
                {isAdmin && showFlaggedOnly ? (
                  <>
                    Showing <strong>only flagged</strong> places whose name
                    contains{" "}
                  </>
                ) : (
                  "Showing places whose name contains "
                )}
                <span className="text-body">
                  &quot;{nameSearchApplied.trim()}&quot;
                </span>
                .
              </>
            ) : isAdmin && showFlaggedOnly ? (
              <>
                Showing <strong>only flagged</strong> places.
              </>
            ) : listViewMode === "column" ? (
              <>
                Open <strong>Filters</strong> for lists. Use <strong>column
                headers</strong> for sort, tags (match <strong>all</strong>),
                name text, and other column filters.
              </>
            ) : (
              <>
                Open <strong>Filters</strong> to narrow by tags or lists. Tag
                filters use partial match and combine with <strong>AND</strong>;
                list filters combine with <strong>OR</strong>. Use the search
                icon to filter by place name (Enter to apply).
              </>
            )}
          </p>
        </div>
        {listViewMode === "column" ? (
          <div
            className={`place-tiles-table-wrap${colMenuKey != null ? " place-tiles-table-wrap--menu-open" : ""}`}
            ref={tableWrapRef}
          >
            <table className="modern-table place-tiles-table">
              <colgroup>
                {colWeights.map((fr, i) => (
                  <col key={i} style={{ width: `${fr * 100}%` }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {PLACE_TABLE_HEADER_SPEC.map((spec, colIndex) => {
                    const thKey =
                      spec.role === "drag" ? "drag" : spec.sortKey;
                    const showResizer =
                      colIndex < PLACE_TABLE_HEADER_SPEC.length - 1;
                    if (spec.role === "drag") {
                      return (
                        <th
                          key={thKey}
                          className="place-tiles-th-drag"
                          scope="col"
                          aria-label="Drag into list"
                        >
                          {showResizer ? (
                            <div
                              className="place-tiles-col-resizer"
                              role="separator"
                              aria-orientation="vertical"
                              aria-label="Resize after drag column"
                              onMouseDown={(e) =>
                                handleColResizeStart(e, colIndex)
                              }
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : null}
                        </th>
                      );
                    }
                    const sk = spec.sortKey;
                    const isNotes = sk === "notes";
                    const menuOpenHere = colMenuKey === sk;
                    return (
                      <th
                        key={thKey}
                        className={`${isNotes ? "place-tiles-th-notes " : ""}${menuOpenHere ? "place-tiles-th-menu-open" : ""}`.trim()}
                        scope="col"
                      >
                        <div className="place-tiles-col-head-cell">
                          <button
                            type="button"
                            className={`place-tiles-col-sort-btn${menuOpenHere ? " is-open" : ""}${headerHasColFilter(sk) ? " has-col-filter" : ""}`}
                            aria-expanded={menuOpenHere}
                            aria-haspopup="menu"
                            onClick={(e) => {
                              e.stopPropagation();
                              setColMenuKey((k) => (k === sk ? null : sk));
                            }}
                          >
                            {spec.label}
                            {getSortIcon(sk)}
                          </button>
                          {menuOpenHere ? (
                            <div
                              className="place-tiles-col-menu-panel"
                              ref={colMenuRef}
                              role="menu"
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="place-tiles-col-menu-item"
                                role="menuitem"
                                onClick={() => applyColumnSort(sk, "asc")}
                              >
                                Sort ascending
                              </button>
                              <button
                                type="button"
                                className="place-tiles-col-menu-item"
                                onClick={() => applyColumnSort(sk, "desc")}
                              >
                                Sort descending
                              </button>
                              <div
                                className="place-tiles-col-menu-divider"
                                aria-hidden
                              />
                              <div className="place-tiles-col-menu-filter">
                                <div className="small text-muted mb-2">
                                  Filter by value
                                </div>
                                {renderColumnFilterControls(sk)}
                              </div>
                            </div>
                          ) : null}
                        </div>
                        {showResizer ? (
                          <div
                            className="place-tiles-col-resizer"
                            role="separator"
                            aria-orientation="vertical"
                            aria-label={`Resize after ${spec.label}`}
                            onMouseDown={(e) =>
                              handleColResizeStart(e, colIndex)
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : null}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {displayPlaces && displayPlaces.length > 0 ? (
                  displayPlaces.map((place) => {
                    const tags = normalizeTags(place.tags);
                    const priceLabel = formatPriceRangeDollars(
                      place.price_range
                    );
                    const flagCount = Number(place.flag_count) || 0;
                    const hasFlags = flagCount > 0;
                    const notesText = place.notes?.trim() || "";
                    const hasNotes = Boolean(notesText);
                    return (
                      <tr
                        key={place.id}
                        className={`place-tiles-table-row${hasNotes ? " place-tiles-table-row--notes" : ""}${hasFlags ? " place-tiles-table-row--flag" : ""}`}
                        onClick={() => handlePlaceSelect(place.id)}
                        tabIndex={0}
                        role="link"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handlePlaceSelect(place.id);
                          }
                        }}
                      >
                        <td className="place-tiles-td-drag">
                          <button
                            type="button"
                            className="place-tile-drag-handle place-tile-drag-handle--table"
                            draggable
                            title="Drag into list (left)"
                            aria-label={`Drag ${place.name || "place"} to add to a list`}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            onDragStart={(e) => {
                              e.stopPropagation();
                              setPlaceDragData(e.dataTransfer, {
                                id: place.id,
                                name: place.name,
                                location: place.location,
                                price_range: place.price_range ?? null,
                              });
                              e.dataTransfer.effectAllowed = "copy";
                            }}
                          >
                            <i className="fas fa-grip-vertical" aria-hidden />
                          </button>
                        </td>
                        <td>
                          <div className="place-tiles-table-name-cell">
                            {hasFlags ? (
                              <span
                                className="place-tiles-table-flag"
                                title={`${flagCount} flag report${flagCount === 1 ? "" : "s"}`}
                                aria-label="This place has been flagged"
                              >
                                <i className="fas fa-flag" aria-hidden />
                              </span>
                            ) : null}
                            <span className="place-tiles-table-name-text">
                              {place.name}
                            </span>
                          </div>
                        </td>
                        <td
                          className="place-tiles-td-notes"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          {hasNotes ? (
                            <div
                              className="place-tiles-table-notes-preview"
                              title={notesText}
                            >
                              {(notesText.split(/\r?\n/, 1)[0] ?? "").trim() ||
                                "—"}
                            </div>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td
                          title={
                            place.location?.trim()
                              ? place.location.trim()
                              : undefined
                          }
                        >
                          <span className="place-tiles-table-location">
                            {place.location?.trim() ? (
                              cityStateFromLocation(place.location)
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </span>
                        </td>
                        <td>
                          {priceLabel ? (
                            priceLabel
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td>
                          {!place.reviews_disabled ? (
                            <div className="place-tiles-table-rating rating-display">
                              {renderRating(place)}
                            </div>
                          ) : (
                            <span className="text-muted small">—</span>
                          )}
                        </td>
                        <td>
                          <div
                            className="place-tile-tags place-tile-tags--table"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            {tags.length === 0 ? (
                              <span className="text-muted small">No tags</span>
                            ) : (
                              tags.map((t) => (
                                <span
                                  key={t.id}
                                  className="place-tile-tag badge rounded-pill"
                                >
                                  {t.name}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr className="place-tiles-table-empty-row">
                    <td
                      colSpan={PLACE_TABLE_HEADER_SPEC.length}
                      className="place-tiles-table-empty-cell"
                    >
                      <p className="place-tiles-empty place-tiles-empty--table text-muted mb-0">
                        {emptyPlacesMessage}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : !displayPlaces || displayPlaces.length === 0 ? (
          <p className="place-tiles-empty text-muted mb-0">
            {emptyPlacesMessage}
          </p>
        ) : (
          <div className="place-tiles-grid">
            {displayPlaces.map((place) => {
              const tags = normalizeTags(place.tags);
              const priceLabel = formatPriceRangeDollars(place.price_range);
              const notesText = place.notes?.trim() || "";
              const hasNotes = Boolean(notesText);
              const notesTooltipFirstLine =
                notesText.split(/\r?\n/, 1)[0].trim();
              const flagCount = Number(place.flag_count) || 0;
              const hasFlags = flagCount > 0;
              return (
                <article
                  className={`place-tile${hasNotes ? " place-tile--has-notes" : ""}${hasFlags ? " place-tile--has-flag" : ""}`}
                  key={place.id}
                >
                  {hasFlags ? (
                    <span
                      className="place-tile-flag-icon"
                      title={`${flagCount} flag report${flagCount === 1 ? "" : "s"}`}
                      aria-label="This place has been flagged"
                    >
                      <i className="fas fa-flag" aria-hidden />
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="place-tile-drag-handle"
                    draggable
                    title="Drag into list (left)"
                    aria-label={`Drag ${place.name || "place"} to add to a list`}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    onDragStart={(e) => {
                      e.stopPropagation();
                      setPlaceDragData(e.dataTransfer, {
                        id: place.id,
                        name: place.name,
                        location: place.location,
                        price_range: place.price_range ?? null,
                      });
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                  >
                    <i className="fas fa-grip-vertical" aria-hidden />
                  </button>
                  <div
                    className="place-tile-main"
                    onClick={() => handlePlaceSelect(place.id)}
                    role="link"
                    tabIndex={0}
                    aria-describedby={
                      hasNotes ? `place-tile-notes-${place.id}` : undefined
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handlePlaceSelect(place.id);
                      }
                    }}
                  >
                    <h3 className="place-tile-name">{place.name}</h3>
                    {priceLabel ? (
                      <p className="place-tile-price-range mb-0">{priceLabel}</p>
                    ) : null}
                    <p className="place-tile-location">
                      <i
                        className="fas fa-map-marker-alt place-tile-location-icon"
                        aria-hidden
                      />
                      <span>{place.location}</span>
                    </p>
                    <div
                      className="place-tile-tags"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      {tags.length === 0 ? (
                        <span className="text-muted small">No tags</span>
                      ) : (
                        tags.map((t) => (
                          <span
                            key={t.id}
                            className="place-tile-tag badge rounded-pill"
                          >
                            {t.name}
                          </span>
                        ))
                      )}
                    </div>
                    {!place.reviews_disabled ? (
                      <div className="place-tile-rating rating-display">
                        {renderRating(place)}
                      </div>
                    ) : null}
                  </div>
                  {hasNotes ? (
                    <div
                      id={`place-tile-notes-${place.id}`}
                      className="place-tile-notes-tooltip"
                      role="tooltip"
                    >
                      <span className="place-tile-notes-tooltip-label">
                        Public notes
                      </span>
                      <p className="place-tile-notes-tooltip-text mb-0">
                        {notesTooltipFirstLine}
                      </p>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>

    </>
  );
};

export default PlaceList;
