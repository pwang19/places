import React, { useContext, useEffect, useState } from "react";
import PlaceFinder from "../apis/PlaceFinder";
import { PlacesContext } from "../context/PlacesContext";
import LocationAutocomplete from "./LocationAutocomplete";
import TagInput from "./TagInput";
import { normalizeTags } from "../utils/tags";

const UpdatePlace = ({
  showModal,
  onClose,
  placeId,
  onUpdated,
  onDeleted,
}) => {
  const { setPlaces } = useContext(PlacesContext);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [notes, setNotes] = useState("");
  const [tagList, setTagList] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const syncPlaceAfterTagChange = async () => {
    if (!placeId) return;
    try {
      const res = await PlaceFinder.get(`/${placeId}`);
      const placeRow = res.data.data.place;
      setTagList(normalizeTags(placeRow.tags));
      onUpdated?.(placeRow);
    } catch (err) {
      console.error("Error refreshing place after tag change:", err);
    }
  };

  // Fetch place data when modal opens
  useEffect(() => {
    if (showModal && placeId) {
      const fetchData = async () => {
        try {
          const response = await PlaceFinder.get(`/${placeId}`);
          const place = response.data.data.place;
          setName(place.name);
          setLocation(place.location);
          setPriceRange(
            place.price_range != null && place.price_range !== ""
              ? String(place.price_range)
              : ""
          );
          setNotes(place.notes ?? "");
          setTagList(normalizeTags(place.tags));
        } catch (err) {
          console.error("Error fetching place:", err);
        }
      };
      fetchData();
    }
  }, [showModal, placeId]);

  // Reset form when modal closes
  useEffect(() => {
    if (!showModal) {
      setName("");
      setLocation("");
      setPriceRange("");
      setNotes("");
      setTagList([]);
      setShowDeleteConfirm(false);
    }
  }, [showModal]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showModal]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !location) {
      return;
    }

    try {
      const response = await PlaceFinder.put(`/${placeId}`, {
        name: name,
        location: location,
        price_range: priceRange === "" ? null : Number(priceRange),
        notes: notes.trim() || null,
      });
      
      const updated = response.data.data.place;
      setPlaces((prev) =>
        prev.map((place) =>
          String(place.id) === String(placeId) ? updated : place
        )
      );
      onUpdated?.(updated);

      // Close modal and reset form on success
      onClose();
      setName("");
      setLocation("");
      setPriceRange("");
      setNotes("");
      setTagList([]);
    } catch (err) {
      console.error("Error updating place:", err);
    }
  };

  const handleClose = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    onClose();
  };

  const cancelDeleteConfirm = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setShowDeleteConfirm(false);
  };

  const confirmDelete = async (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!placeId) return;
    try {
      await PlaceFinder.delete(`/${placeId}`);
      setPlaces((prev) =>
        prev.filter((p) => String(p.id) !== String(placeId))
      );
      setShowDeleteConfirm(false);
      onDeleted?.();
      onClose();
      setName("");
      setLocation("");
      setPriceRange("");
      setNotes("");
      setTagList([]);
    } catch (err) {
      console.error("Error deleting place:", err);
      setShowDeleteConfirm(false);
    }
  };

  if (!showModal) return null;

  return (
    <>
      <div
        className="modal-backdrop show"
        onClick={handleClose}
        style={{ opacity: 0.5, zIndex: 1040 }}
      ></div>
      <div
        className="modal show modern-modal"
        style={{ display: "block", zIndex: 1050 }}
        tabIndex="-1"
        role="dialog"
        onClick={(e) => {
          if (e.target.classList.contains('modal')) {
            handleClose(e);
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
                <i className="fas fa-edit me-2"></i>
                Update Place
              </h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={handleClose}
                aria-label="Close"
              ></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="mb-3">
                  <label htmlFor="updatePlaceName" className="form-label">
                    Place Name
                  </label>
                  <input
                    id="updatePlaceName"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    type="text"
                    className="form-control"
                    placeholder="Enter place name"
                    required
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="updatePlaceLocation" className="form-label">
                    Location
                  </label>
                  <LocationAutocomplete
                    id="updatePlaceLocation"
                    value={location}
                    onChange={setLocation}
                    placeholder="Enter location"
                    required
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="updatePriceRange" className="form-label">
                    Price range
                  </label>
                  <select
                    id="updatePriceRange"
                    value={priceRange}
                    onChange={(e) => setPriceRange(e.target.value)}
                    className="form-select"
                  >
                    <option value="">Not applicable</option>
                    <option value="1">$</option>
                    <option value="2">$$</option>
                    <option value="3">$$$</option>
                    <option value="4">$$$$</option>
                    <option value="5">$$$$$</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label htmlFor="updatePlaceNotes" className="form-label">
                    Notes <span className="text-muted fw-normal">(optional)</span>
                  </label>
                  <textarea
                    id="updatePlaceNotes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="form-control"
                    rows={3}
                    placeholder="Parking tips, hours, favorites…"
                  />
                </div>
                <div className="mb-1">
                  <label className="form-label d-block">Tags</label>
                  {tagList.length > 0 ? (
                    <div className="d-flex flex-wrap gap-2 mb-2">
                      {tagList.map((t) => (
                        <span
                          key={t.id}
                          className="badge rounded-pill d-inline-flex align-items-center gap-2"
                          style={{
                            background: "rgba(24, 144, 255, 0.12)",
                            color: "var(--text-heading)",
                            border: "1px solid var(--border-color)",
                            fontSize: "0.85rem",
                            padding: "0.4em 0.65em",
                          }}
                        >
                          {t.name}
                          <button
                            type="button"
                            className="btn btn-sm btn-link p-0 m-0"
                            style={{
                              lineHeight: 1,
                              textDecoration: "none",
                              color: "var(--text-muted)",
                            }}
                            title="Remove tag"
                            aria-label={`Remove tag ${t.name}`}
                            onClick={async () => {
                              try {
                                await PlaceFinder.delete(
                                  `/${placeId}/tags/${t.id}`
                                );
                                await syncPlaceAfterTagChange();
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted small mb-2">No tags yet.</p>
                  )}
                  <TagInput
                    id="update-place-tag-input"
                    placeholder="Add a tag (type, suggestion, then Enter)"
                    showHint={true}
                    onSubmitName={async (raw) => {
                      await PlaceFinder.post(`/${placeId}/tags`, {
                        name: raw,
                      });
                      await syncPlaceAfterTagChange();
                    }}
                  />
                </div>
              </div>
              <div className="modal-footer d-flex flex-wrap justify-content-between align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-modern btn-danger-modern"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <i className="fas fa-trash me-2"></i>
                  Delete place
                </button>
                <div className="d-flex flex-wrap gap-2 ms-auto">
                  <button
                    type="button"
                    className="btn btn-modern btn-secondary-modern"
                    onClick={handleClose}
                  >
                    <i className="fas fa-times me-2"></i>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-modern btn-primary-modern"
                  >
                    <i className="fas fa-save me-2"></i>
                    Update Place
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {showDeleteConfirm ? (
        <>
          <div
            className="modal-backdrop show"
            onClick={cancelDeleteConfirm}
            style={{ opacity: 0.55, zIndex: 1060 }}
          />
          <div
            className="modal show modern-modal"
            style={{ display: "block", zIndex: 1070 }}
            tabIndex="-1"
            role="dialog"
            aria-modal="true"
            aria-labelledby="update-place-delete-title"
            onClick={(e) => {
              if (e.target.classList.contains("modal")) {
                cancelDeleteConfirm(e);
              }
            }}
          >
            <div
              className="modal-dialog modal-dialog-centered"
              role="document"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="modal-content"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header">
                  <h5 className="modal-title" id="update-place-delete-title">
                    <i className="fas fa-exclamation-triangle me-2"></i>
                    Confirm Delete
                  </h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={cancelDeleteConfirm}
                    aria-label="Close"
                  />
                </div>
                <div className="modal-body">
                  <p>
                    Are you sure you want to delete{" "}
                    <strong>{name.trim() || "this place"}</strong>?
                  </p>
                  <p className="text-danger mb-0">
                    <i className="fas fa-info-circle me-2"></i>
                    This will permanently delete the place and all its associated
                    reviews. This action cannot be undone.
                  </p>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-modern btn-secondary-modern"
                    onClick={cancelDeleteConfirm}
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
      ) : null}
    </>
  );
};

export default UpdatePlace;
