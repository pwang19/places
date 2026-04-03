import React, { useContext, useState, useEffect } from "react";
import PlaceFinder from "../apis/PlaceFinder";
import { PlacesContext } from "../context/PlacesContext";
import LocationAutocomplete from "./LocationAutocomplete";
import TagInput from "./TagInput";

const AddPlace = ({ showModal, onClose }) => {
  const { addPlaces } = useContext(PlacesContext);

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [notes, setNotes] = useState("");
  const [pendingTags, setPendingTags] = useState([]);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset form when modal closes
  useEffect(() => {
    if (!showModal) {
      setName("");
      setLocation("");
      setPriceRange("");
      setNotes("");
      setPendingTags([]);
      setSubmitError("");
      setSubmitting(false);
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
    setSubmitError("");
    const trimmedName = name.trim();
    const trimmedLocation = location.trim();
    if (!trimmedName || !trimmedLocation) {
      setSubmitError(
        "Please enter a place name and location before saving."
      );
      return;
    }

    setSubmitting(true);
    try {
      const response = await PlaceFinder.post("/", {
        name: trimmedName,
        location: trimmedLocation,
        price_range: priceRange === "" ? null : Number(priceRange),
        notes: notes.trim() || undefined,
      });
      const newId = response.data?.data?.place?.id;
      if (newId == null) {
        throw new Error("Unexpected response from server.");
      }
      for (const tagName of pendingTags) {
        await PlaceFinder.post(`/${newId}/tags`, { name: tagName });
      }
      const refreshed = await PlaceFinder.get(`/${newId}`);
      addPlaces(refreshed.data.data.place);
      onClose();
      setName("");
      setLocation("");
      setPriceRange("");
      setNotes("");
      setPendingTags([]);
    } catch (err) {
      console.error("Error adding place:", err);
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        (typeof err.response?.data === "string" ? err.response.data : null) ||
        err.message ||
        "Could not save the place. Check that the API is running and the database is up to date.";
      setSubmitError(String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    onClose();
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
                <i className="fas fa-plus-circle me-2"></i>
                Add New Place
              </h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={handleClose}
                aria-label="Close"
              ></button>
            </div>
            <form onSubmit={handleSubmit} noValidate>
              <div className="modal-body">
                {submitError ? (
                  <div
                    className="alert alert-danger mb-3"
                    role="alert"
                  >
                    {submitError}
                  </div>
                ) : null}
                <div className="mb-3">
                  <label htmlFor="placeName" className="form-label">
                    Place Name
                  </label>
                  <input
                    id="placeName"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    type="text"
                    className="form-control"
                    placeholder="Enter place name"
                    required
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="placeLocation" className="form-label">
                    Location
                  </label>
                  <LocationAutocomplete
                    id="placeLocation"
                    value={location}
                    onChange={setLocation}
                    placeholder="Enter location"
                    required
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="priceRange" className="form-label">
                    Price range
                  </label>
                  <select
                    id="priceRange"
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
                  <label htmlFor="placeNotes" className="form-label">
                    Notes <span className="text-muted fw-normal">(optional)</span>
                  </label>
                  <textarea
                    id="placeNotes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="form-control"
                    rows={3}
                    placeholder="Parking tips, hours, favorites…"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label d-block">
                    Tags <span className="text-muted fw-normal">(optional)</span>
                  </label>
                  {pendingTags.length > 0 ? (
                    <div className="d-flex flex-wrap gap-2 mb-2">
                      {pendingTags.map((tagName) => (
                        <span
                          key={tagName}
                          className="badge rounded-pill d-inline-flex align-items-center gap-2"
                          style={{
                            background: "rgba(24, 144, 255, 0.12)",
                            color: "var(--text-heading)",
                            border: "1px solid var(--border-color)",
                            fontSize: "0.85rem",
                            padding: "0.4em 0.65em",
                          }}
                        >
                          {tagName}
                          <button
                            type="button"
                            className="btn btn-sm btn-link p-0 m-0"
                            style={{
                              lineHeight: 1,
                              textDecoration: "none",
                              color: "var(--text-muted)",
                            }}
                            title="Remove tag"
                            aria-label={`Remove tag ${tagName}`}
                            onClick={() =>
                              setPendingTags((prev) =>
                                prev.filter((t) => t !== tagName)
                              )
                            }
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <TagInput
                    id="add-place-tag-input"
                    placeholder="Add a tag (type, suggestion, then Enter)"
                    showHint={true}
                    onSubmitName={(raw) => {
                      const trimmed = raw.trim();
                      if (!trimmed) return Promise.resolve();
                      setPendingTags((prev) =>
                        prev.some(
                          (t) => t.toLowerCase() === trimmed.toLowerCase()
                        )
                          ? prev
                          : [...prev, trimmed]
                      );
                      return Promise.resolve();
                    }}
                  />
                </div>
              </div>
              <div className="modal-footer">
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
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <i className="fas fa-spinner fa-spin me-2"></i>
                      Saving…
                    </>
                  ) : (
                    <>
                      <i className="fas fa-plus me-2"></i>
                      Add Place
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default AddPlace;
