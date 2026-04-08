import React, {
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import PlaceFinder from "../apis/PlaceFinder.js";
import { PlacesContext } from "../context/PlacesContext";
import { useNavigate } from "react-router-dom";
import StarRating from "../components/StarRating";
import TagInput from "../components/TagInput";
import { normalizeTags } from "../utils/tags";
import { formatPriceRangeDollars } from "../utils/priceRange";
import { setPlaceDragData } from "../utils/placeDrag";

const PlaceList = (props) => {
  const { places, setPlaces } = useContext(PlacesContext);
  let navigate = useNavigate(); // useNavigate function to navigate to place details page
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'
  const [activeFilterTags, setActiveFilterTags] = useState([]);
  const [nameSearchOpen, setNameSearchOpen] = useState(false);
  const [nameSearchInput, setNameSearchInput] = useState("");
  const [nameSearchApplied, setNameSearchApplied] = useState("");
  const nameSearchInputRef = useRef(null);

  const loadPlaces = useCallback(
    async (tagsArray) => {
      try {
        const list = Array.isArray(tagsArray) ? tagsArray : [];
        const response = await PlaceFinder.get("/", {
          params:
            list.length > 0
              ? { tag: list }
              : {},
          paramsSerializer: {
            serialize: (params) => {
              const raw = params.tag;
              if (raw == null || raw === "") return "";
              const arr = Array.isArray(raw) ? raw : [raw];
              return arr
                .map((t) => `tag=${encodeURIComponent(String(t))}`)
                .join("&");
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
    loadPlaces(activeFilterTags);
  }, [activeFilterTags, loadPlaces]);

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
      <div className="modern-table-container">
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
              <span
                className="place-tiles-sort-label place-tiles-filter-section-start"
                id="place-list-filter-heading"
              >
                Filter By Tag(s)
              </span>
              <div className="place-tiles-filter-input-wrap">
                <TagInput
                  id="place-list-tag-filter"
                  placeholder="Add tag, press Enter"
                  showHint={false}
                  aria-labelledby="place-list-filter-heading"
                  aria-describedby="place-list-filter-desc"
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
              {activeFilterTags.map((tag) => (
                <span
                  key={tag}
                  className="place-tiles-tag-filter-pill"
                >
                  <span className="place-tiles-tag-filter-pill-text">{tag}</span>
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
              activeFilterTags.length === 0 && !nameSearchApplied.trim()
                ? " visually-hidden"
                : ""
            }`}
          >
            {activeFilterTags.length > 0 ? (
              <>
                Showing places that match <strong>all</strong> of these tags:{" "}
                <span className="text-body">
                  {activeFilterTags.map((t) => `"${t}"`).join(", ")}
                </span>
                {nameSearchApplied.trim() ? (
                  <>
                    {" "}
                    · Name contains{" "}
                    <span className="text-body">
                      &quot;{nameSearchApplied.trim()}&quot;
                    </span>
                  </>
                ) : null}
              </>
            ) : nameSearchApplied.trim() ? (
              <>
                Showing places whose name contains{" "}
                <span className="text-body">
                  &quot;{nameSearchApplied.trim()}&quot;
                </span>
                .
              </>
            ) : (
              <>
                Add tags with Enter. A place must match every selected tag
                (partial name match). Remove a tag with the pill ×. Use the
                search icon to filter by place name (Enter to apply).
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
                : "No places to show."}
            </p>
          ) : null}
          {displayPlaces &&
            displayPlaces.map((place) => {
              const tags = normalizeTags(place.tags);
              const priceLabel = formatPriceRangeDollars(place.price_range);
              const notesText = place.notes?.trim() || "";
              const hasNotes = Boolean(notesText);
              return (
                <article
                  className={`place-tile${hasNotes ? " place-tile--has-notes" : ""}`}
                  key={place.id}
                >
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
                        {notesText}
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
