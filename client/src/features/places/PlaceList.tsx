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
import { setPlaceDragData } from "../../utils/placeDrag";

const PlaceList = (props) => {
  const { places, setPlaces } = usePlacesContext();
  const { isAdmin } = useAuth();
  let navigate = useNavigate(); // useNavigate function to navigate to place details page
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'
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

  useEffect(() => {
    if (!isAdmin && showFlaggedOnly) {
      setShowFlaggedOnly(false);
    }
  }, [isAdmin, showFlaggedOnly]);

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
    const q = nameSearchApplied.trim().toLowerCase();
    if (!q) return sortedPlaces;
    return sortedPlaces.filter((p) =>
      (p.name || "").toLowerCase().includes(q)
    );
  }, [sortedPlaces, nameSearchApplied]);

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
              <div
                className="place-tiles-filters-wrap place-tiles-filter-section-start"
                ref={filtersWrapRef}
              >
                <button
                  type="button"
                  className={`place-tiles-filters-trigger${activeFilterTags.length > 0 || activeListIds.length > 0 ? " has-active-filters" : ""}`}
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
                    aria-label="Filter places by tags and lists"
                  >
                    <div className="place-tiles-filters-panel-body">
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
                                      t.toLowerCase() === trimmed.toLowerCase()
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
          </div>
          <p
            id="place-list-filter-desc"
            className={`place-tiles-filter-hint text-muted small mb-0${
              activeFilterTags.length === 0 &&
              activeListIds.length === 0 &&
              !nameSearchApplied.trim() &&
              !(isAdmin && showFlaggedOnly)
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
                {nameSearchApplied.trim() ? (
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
            ) : nameSearchApplied.trim() ? (
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
        <div className="place-tiles-grid">
          {!displayPlaces || displayPlaces.length === 0 ? (
            <p className="place-tiles-empty text-muted mb-0">
              {sortedPlaces &&
              sortedPlaces.length > 0 &&
              nameSearchApplied.trim()
                ? "No places match that name."
                : activeFilterTags.length > 0 || activeListIds.length > 0
                  ? "No places match these filters."
                  : isAdmin && showFlaggedOnly
                    ? "No flagged places."
                    : "No places to show."}
            </p>
          ) : null}
          {displayPlaces &&
            displayPlaces.map((place) => {
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
      </div>

    </>
  );
};

export default PlaceList;
