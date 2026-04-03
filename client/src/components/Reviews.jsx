import React, { useState } from "react";
import PlaceFinder from "../apis/PlaceFinder";
import StarRating from "./StarRating";

const Reviews = ({ reviews, placeId, onReviewsChanged, onEditReview }) => {
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (review) => {
    if (!placeId || !review?.id) return;
    if (
      !window.confirm(
        "Delete this review? This cannot be undone."
      )
    ) {
      return;
    }
    setDeletingId(review.id);
    try {
      await PlaceFinder.delete(`/${placeId}/reviews/${review.id}`);
      await onReviewsChanged?.();
    } catch (err) {
      console.error(err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Could not delete the review.";
      window.alert(String(msg));
    } finally {
      setDeletingId(null);
    }
  };

  if (!reviews || reviews.length === 0) {
    return (
      <div className="text-center py-5">
        <i className="fas fa-comment-slash fa-3x mb-3" style={{ color: "var(--border-color)" }}></i>
        <p style={{ color: "var(--text-muted)" }}>No reviews yet. Be the first to review!</p>
      </div>
    );
  }

  return (
    <div className="row g-3">
      {reviews.map((review) => {
        return (
          <div
            key={review.id}
            className="col-md-6 col-lg-4"
          >
            <div
              className="card mb-3"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-color)",
                borderRadius: "15px",
                boxShadow: "var(--shadow-md)",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow =
                  "0 8px 24px rgba(24, 144, 255, 0.18)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "var(--shadow-md)";
              }}
            >
              <div
                className="card-header d-flex justify-content-between align-items-center"
                style={{
                  background: "var(--surface-muted)",
                  border: "none",
                  borderBottom: "1px solid var(--border-color)",
                  borderRadius: "15px 15px 0 0",
                  padding: "1rem 1.25rem",
                }}
              >
                <span style={{ fontWeight: "600", color: "var(--text-heading)" }}>
                  <i className="fas fa-user me-2"></i>
                  {review.name}
                </span>
                <span>
                  <StarRating rating={review.rating} />
                </span>
              </div>
              <div className="card-body" style={{ padding: "1.25rem" }}>
                <p className="card-text" style={{ color: "var(--text-primary)", margin: 0, lineHeight: "1.6" }}>
                  {review.review}
                </p>
              </div>
              {review.owned_by_me ? (
                <div
                  className="card-footer d-flex flex-wrap gap-2 justify-content-end"
                  style={{
                    background: "transparent",
                    borderTop: "1px solid var(--border-color)",
                    padding: "0.75rem 1.25rem",
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-sm btn-modern btn-warning-modern"
                    onClick={() => onEditReview?.(review)}
                    disabled={deletingId === review.id}
                  >
                    <i className="fas fa-edit me-1" aria-hidden />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-modern btn-secondary-modern"
                    onClick={() => handleDelete(review)}
                    disabled={deletingId === review.id}
                  >
                    {deletingId === review.id ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-1"
                          role="status"
                          aria-hidden
                        />
                        Deleting…
                      </>
                    ) : (
                      <>
                        <i className="fas fa-trash me-1" aria-hidden />
                        Delete
                      </>
                    )}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Reviews;
