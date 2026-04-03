import React, { useState, useEffect } from "react";
import PlaceFinder from "../apis/PlaceFinder";
import { useParams } from "react-router-dom";

const AddReview = ({ showModal, onClose, onSuccess }) => {
  const { id } = useParams();

  const [name, setName] = useState("");
  const [rating, setRating] = useState("Rating");
  const [reviewText, setReviewText] = useState("");

  useEffect(() => {
    if (!showModal) {
      setName("");
      setRating("Rating");
      setReviewText("");
    }
  }, [showModal]);

  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showModal]);

  const handleClose = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    onClose();
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!id || rating === "Rating") return;
    try {
      await PlaceFinder.post(`/${id}/addReview`, {
        name: name,
        review: reviewText,
        rating: rating,
      });
      await onSuccess?.();
      onClose();
      setName("");
      setRating("Rating");
      setReviewText("");
    } catch (err) {
      console.error("Error submitting review:", err);
    }
  };

  if (!showModal) return null;

  return (
    <>
      <div
        className="modal-backdrop show"
        onClick={handleClose}
        style={{ opacity: 0.5, zIndex: 1040 }}
      />
      <div
        className="modal show modern-modal"
        style={{ display: "block", zIndex: 1050 }}
        tabIndex="-1"
        role="dialog"
        aria-labelledby="add-review-modal-title"
        onClick={(e) => {
          if (e.target.classList.contains("modal")) {
            handleClose(e);
          }
        }}
      >
        <div
          className="modal-dialog modal-dialog-centered modal-lg"
          role="document"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h5 className="modal-title" id="add-review-modal-title">
                <i className="fas fa-plus-circle me-2"></i>
                Add Review
              </h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={handleClose}
                aria-label="Close"
              />
            </div>
            <form onSubmit={handleSubmitReview}>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-md-7">
                    <label
                      htmlFor="add-review-name"
                      className="form-label"
                      style={{
                        color: "var(--text-heading)",
                        fontWeight: "600",
                      }}
                    >
                      <i className="fas fa-user me-2"></i>
                      Your Name
                    </label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      type="text"
                      className="form-control"
                      id="add-review-name"
                      style={{
                        background: "var(--surface)",
                        border: "2px solid var(--border-color)",
                        borderRadius: "10px",
                        color: "var(--text-primary)",
                        padding: "0.75rem 1rem",
                      }}
                      placeholder="Enter your name"
                      required
                    />
                  </div>
                  <div className="col-md-5">
                    <label
                      htmlFor="add-review-rating"
                      className="form-label"
                      style={{
                        color: "var(--text-heading)",
                        fontWeight: "600",
                      }}
                    >
                      <i className="fas fa-star me-2"></i>
                      Rating
                    </label>
                    <select
                      value={rating}
                      onChange={(e) => setRating(e.target.value)}
                      id="add-review-rating"
                      className="form-select"
                      style={{
                        background: "var(--surface)",
                        border: "2px solid var(--border-color)",
                        borderRadius: "10px",
                        color: "var(--text-primary)",
                        padding: "0.75rem 1rem",
                      }}
                      required
                    >
                      <option value="Rating" disabled>
                        Select Rating
                      </option>
                      <option value="1">⭐ 1 Star</option>
                      <option value="2">⭐⭐ 2 Stars</option>
                      <option value="3">⭐⭐⭐ 3 Stars</option>
                      <option value="4">⭐⭐⭐⭐ 4 Stars</option>
                      <option value="5">⭐⭐⭐⭐⭐ 5 Stars</option>
                    </select>
                  </div>
                  <div className="col-12">
                    <label
                      htmlFor="add-review-text"
                      className="form-label"
                      style={{
                        color: "var(--text-heading)",
                        fontWeight: "600",
                      }}
                    >
                      <i className="fas fa-comment me-2"></i>
                      Your Review
                    </label>
                    <textarea
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      id="add-review-text"
                      className="form-control"
                      rows={4}
                      style={{
                        background: "var(--surface)",
                        border: "2px solid var(--border-color)",
                        borderRadius: "10px",
                        color: "var(--text-primary)",
                        padding: "0.75rem 1rem",
                        resize: "vertical",
                      }}
                      placeholder="Share your experience..."
                      required
                    />
                  </div>
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
                  style={{ minWidth: "150px" }}
                >
                  <i className="fas fa-paper-plane me-2"></i>
                  Submit Review
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default AddReview;
