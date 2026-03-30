import React, { useContext, useEffect, useState, useMemo, useCallback } from "react";
import PlaceFinder from "../apis/PlaceFinder.js";
import { PlacesContext } from "../context/PlacesContext";
import { useNavigate } from "react-router-dom";
import StarRating from "../components/StarRating";
import UpdatePlace from "../components/UpdatePlace";
import TagInput from "../components/TagInput";
import { normalizeTags } from "../utils/tags";

const PlaceList = (props) => {
  const { places, setPlaces } = useContext(PlacesContext);
  let navigate = useNavigate(); // useNavigate function to navigate to place details page
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [placeToDelete, setPlaceToDelete] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [placeToUpdate, setPlaceToUpdate] = useState(null);
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'
  const [activeTagFilter, setActiveTagFilter] = useState("");

  const loadPlaces = useCallback(
    async (tag) => {
      try {
        const trimmed = tag && String(tag).trim();
        const response = await PlaceFinder.get("/", {
          params: trimmed ? { tag: trimmed } : {},
        });
        setPlaces(response.data.data.places);
      } catch (err) {
        console.log(err);
      }
    },
    [setPlaces]
  );

  useEffect(() => {
    loadPlaces("");
  }, [loadPlaces]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showDeleteModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showDeleteModal]);

  const handleDelete = (e, place) => {
    // e.stopPropagation means when we click Delete button we are not going to send that Event up to the Table row.
    // it doesnt hit the useNavigate function.
    e.stopPropagation();
    setPlaceToDelete(place);
    setShowDeleteModal(true);
  };

  const confirmDelete = async (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!placeToDelete) return;
    
    try {
      const response = await PlaceFinder.delete(`/${placeToDelete.id}`);
      setPlaces(
        places.filter((place) => {
          return place.id !== placeToDelete.id;
        })
      );
      setShowDeleteModal(false);
      setPlaceToDelete(null);
    } catch (err) {
      console.error("Error deleting place:", err);
      setShowDeleteModal(false);
      setPlaceToDelete(null);
    }
  };

  const cancelDelete = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setShowDeleteModal(false);
    setPlaceToDelete(null);
  };

  const handleUpdate = (e, place) => {
    // e.stopPropagation means when we click Update button we are not going to send that Event up to the Table row.
    // it doesnt hit the useNavigate function.
    e.stopPropagation();
    setPlaceToUpdate(place.id);
    setShowUpdateModal(true);
  };

  const handleCloseUpdateModal = () => {
    setShowUpdateModal(false);
    setPlaceToUpdate(null);
  };

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
          aValue = a.price_range || 0;
          bValue = b.price_range || 0;
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

  const getSortIcon = (column) => {
    if (sortColumn !== column) {
      return <span className="ms-2" style={{ color: '#ffc857', opacity: 0.6 }}>↕️</span>;
    }
    return sortDirection === 'asc' 
      ? <span className="ms-2" style={{ color: '#ffc857' }}>↑</span>
      : <span className="ms-2" style={{ color: '#ffc857' }}>↓</span>;
  };

  const renderRating = (place) => {
    if (!place.count) {
      return <span className="ml-1" style={{ color: '#ffc857' }}>0 reviews</span>
    }
    return (
      <>
        <StarRating rating={place.id} />
        <span className="ml-1" style={{ color: '#ffc857' }}>({place.count})</span>
      </>
    );
  };

  return (
    <>
      <div className="px-2 mb-3">
        <label className="form-label mb-1" htmlFor="place-list-tag-filter">
          <i className="fas fa-search me-2"></i>
          Search places by tag
        </label>
        <div className="d-flex flex-wrap align-items-start gap-2">
          <div style={{ flex: "1 1 280px", maxWidth: "440px" }}>
            <TagInput
              id="place-list-tag-filter"
              placeholder="e.g. coffee — press Enter to filter"
              showHint={false}
              onSubmitName={async (name) => {
                await loadPlaces(name);
                setActiveTagFilter(name);
              }}
            />
          </div>
          {activeTagFilter ? (
            <button
              type="button"
              className="btn btn-modern btn-secondary-modern align-self-center"
              onClick={async () => {
                setActiveTagFilter("");
                await loadPlaces("");
              }}
            >
              <i className="fas fa-times me-2"></i>
              Clear filter
            </button>
          ) : null}
        </div>
        {activeTagFilter ? (
          <p className="text-muted small mb-0 mt-2">
            Showing places with a tag matching &quot;{activeTagFilter}&quot;
          </p>
        ) : null}
      </div>
      <div className="modern-table-container">
        <table className="modern-table align-middle">
          <thead>
            <tr>
              <th 
                scope="col"
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={(e) => handleSortClick(e, 'name')}
              >
                <i className="fas fa-store me-2"></i>
                Place {getSortIcon('name')}
              </th>
              <th 
                scope="col"
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={(e) => handleSortClick(e, 'location')}
              >
                <i className="fas fa-map-marker-alt me-2"></i>
                Location {getSortIcon('location')}
              </th>
              <th 
                scope="col"
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={(e) => handleSortClick(e, 'price_range')}
              >
                <i className="fas fa-dollar-sign me-2"></i>
                Price Range {getSortIcon('price_range')}
              </th>
              <th scope="col">
                <i className="fas fa-tags me-2"></i>
                Tags
              </th>
              <th 
                scope="col"
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={(e) => handleSortClick(e, 'ratings')}
              >
                <i className="fas fa-star me-2"></i>
                Ratings {getSortIcon('ratings')}
              </th>
              <th scope="col">
                <i className="fas fa-edit me-2"></i>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedPlaces &&
              sortedPlaces.map((place) => {
                const tags = normalizeTags(place.tags);
                return (
                  <tr
                    onClick={() => handlePlaceSelect(place.id)}
                    key={place.id}
                  >
                    <td><strong>{place.name}</strong></td>
                    <td>
                      <i className="fas fa-map-marker-alt me-2" style={{ color: '#ffc857' }}></i>
                      {place.location}
                    </td>
                    <td>
                      <span className="price-range">{"$".repeat(place.price_range)}</span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="d-flex flex-wrap gap-1">
                        {tags.length === 0 ? (
                          <span className="text-muted small">—</span>
                        ) : (
                          tags.map((t) => (
                            <span
                              key={t.id}
                              className="badge rounded-pill"
                              style={{
                                background: "rgba(255, 200, 87, 0.2)",
                                color: "#ffc857",
                                fontWeight: 500,
                              }}
                            >
                              {t.name}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="rating-display">{renderRating(place)}</td>
                    <td>
                      <div className="d-flex gap-2">
                        <button
                          onClick={(e) => handleUpdate(e, place)}
                          className="btn btn-modern btn-warning-modern"
                          title="Update"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, place)}
                          className="btn btn-modern btn-danger-modern"
                          title="Delete"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <>
          <div
            className="modal-backdrop show"
            onClick={cancelDelete}
            style={{ opacity: 0.5, zIndex: 1040 }}
          ></div>
          <div
            className="modal show modern-modal"
            style={{ display: "block", zIndex: 1050 }}
            tabIndex="-1"
            role="dialog"
            onClick={(e) => {
              // Only close if clicking directly on the modal container (not on modal-dialog or modal-content)
              if (e.target.classList.contains('modal')) {
                cancelDelete(e);
              }
            }}
          >
            <div 
              className="modal-dialog modal-dialog-centered" 
              role="document"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h5 className="modal-title">
                    <i className="fas fa-exclamation-triangle me-2"></i>
                    Confirm Delete
                  </h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={cancelDelete}
                    aria-label="Close"
                  ></button>
                </div>
                <div className="modal-body">
                  <p>
                    Are you sure you want to delete{" "}
                    <strong>{placeToDelete?.name}</strong>?
                  </p>
                  <p className="text-danger">
                    <i className="fas fa-info-circle me-2"></i>
                    This will permanently delete the place and all its associated reviews.
                    This action cannot be undone.
                  </p>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-modern btn-secondary-modern"
                    onClick={cancelDelete}
                  >
                    <i className="fas fa-times me-2"></i>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-modern btn-danger-modern"
                    onClick={confirmDelete}
                  >
                    <i className="fas fa-trash me-2"></i>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Update Place Modal */}
      <UpdatePlace
        showModal={showUpdateModal}
        onClose={handleCloseUpdateModal}
        placeId={placeToUpdate}
      />
    </>
  );
};

export default PlaceList;
