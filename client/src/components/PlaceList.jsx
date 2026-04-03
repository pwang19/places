import React, { useContext, useEffect, useState, useMemo, useCallback } from "react";
import PlaceFinder from "../apis/PlaceFinder.js";
import { PlacesContext } from "../context/PlacesContext";
import { useNavigate } from "react-router-dom";
import StarRating from "../components/StarRating";
import TagInput from "../components/TagInput";
import { normalizeTags } from "../utils/tags";
import { formatPriceRangeDollars } from "../utils/priceRange";

const PlaceList = (props) => {
  const { places, setPlaces } = useContext(PlacesContext);
  let navigate = useNavigate(); // useNavigate function to navigate to place details page
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'
  const [activeFilterTags, setActiveFilterTags] = useState([]);

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
        case 'location':
          aValue = (a.location || '').toLowerCase();
          bValue = (b.location || '').toLowerCase();
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

  const sortLabels = {
    name: "Name",
    location: "Location",
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
            <span className="place-tiles-sort-label">Sort by</span>
            {["name", "location", "price_range", "ratings"].map((column) => (
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
          <p
            id="place-list-filter-desc"
            className={`place-tiles-filter-hint text-muted small mb-0${activeFilterTags.length === 0 ? " visually-hidden" : ""}`}
          >
            {activeFilterTags.length > 0 ? (
              <>
                Showing places that match <strong>all</strong> of these tags:{" "}
                <span className="text-body">
                  {activeFilterTags.map((t) => `"${t}"`).join(", ")}
                </span>
              </>
            ) : (
              <>
                Add tags with Enter. A place must match every selected tag
                (partial name match). Remove a tag with the pill ×.
              </>
            )}
          </p>
        </div>
        <div className="place-tiles-grid">
          {sortedPlaces && sortedPlaces.length === 0 ? (
            <p className="place-tiles-empty text-muted mb-0">No places to show.</p>
          ) : null}
          {sortedPlaces &&
            sortedPlaces.map((place) => {
              const tags = normalizeTags(place.tags);
              const priceLabel = formatPriceRangeDollars(place.price_range);
              return (
                <article className="place-tile" key={place.id}>
                  <div
                    className="place-tile-main"
                    onClick={() => handlePlaceSelect(place.id)}
                    role="link"
                    tabIndex={0}
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
                    <div className="place-tile-rating rating-display">
                      {renderRating(place)}
                    </div>
                  </div>
                </article>
              );
            })}
        </div>
      </div>

    </>
  );
};

export default PlaceList;
