import React, { useMemo, useState } from "react";
import PlaceFinder from "../../api/placesApi";
import StarRating from "../../components/ui/StarRating";

function reviewVoteLabel(review) {
  const up = Number(review.upvotes) || 0;
  const down = Number(review.downvotes) || 0;
  if (up === 0 && down === 0) return "0";
  const totalRaw = Number(review.vote_total);
  const total = Number.isFinite(totalRaw) ? totalRaw : up - down;
  return `${total} (+${up}/-${down})`;
}

function sortReviewsForDisplay(reviews) {
  if (!reviews?.length) return [];
  return [...reviews].sort((a, b) => {
    const ao = a.owned_by_me ? 1 : 0;
    const bo = b.owned_by_me ? 1 : 0;
    if (bo !== ao) return bo - ao;
    return Number(b.id) - Number(a.id);
  });
}

const Reviews = ({ reviews, placeId, onReviewsChanged, onEditReview, isAdmin }) => {
  const [deletingId, setDeletingId] = useState(null);
  const [votingId, setVotingId] = useState(null);
  const displayReviews = useMemo(() => sortReviewsForDisplay(reviews), [reviews]);

  const handleDelete = async (review) => {
    if (!placeId || !review?.id) return;
    const own = Boolean(review.owned_by_me);
    const msg = own
      ? "Delete this review? This cannot be undone."
      : "Delete this review as an admin? This cannot be undone.";
    if (!window.confirm(msg)) {
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

  const handleVotePress = async (review, vote) => {
    if (!placeId || !review?.id || review.owned_by_me) return;
    setVotingId(review.id);
    try {
      if (review.my_vote === vote) {
        await PlaceFinder.delete(`/${placeId}/reviews/${review.id}/vote`);
      } else {
        await PlaceFinder.post(`/${placeId}/reviews/${review.id}/vote`, { vote });
      }
      await onReviewsChanged?.();
    } catch (err) {
      console.error(err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Could not save your vote.";
      window.alert(String(msg));
    } finally {
      setVotingId(null);
    }
  };

  if (!displayReviews.length) {
    return (
      <div className="text-center py-5">
        <i className="fas fa-comment-slash fa-3x mb-3" style={{ color: "var(--border-color)" }}></i>
        <p style={{ color: "var(--text-muted)" }}>No reviews yet. Be the first to review!</p>
      </div>
    );
  }

  return (
    <div className="row g-3">
      {displayReviews.map((review) => {
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
              <div
                className="card-body d-flex flex-column"
                style={{ padding: "1.25rem", flex: "1 1 auto" }}
              >
                <p
                  className="card-text"
                  style={{
                    color: "var(--text-primary)",
                    margin: 0,
                    lineHeight: "1.6",
                    flex: "1 1 auto",
                  }}
                >
                  {review.review}
                </p>
                <div
                  className="d-flex align-items-center justify-content-end flex-wrap gap-2 mt-3 pt-2"
                  style={{ borderTop: "1px solid var(--border-color)" }}
                >
                  {!review.owned_by_me ? (
                    votingId === review.id ? (
                      <span className="spinner-border spinner-border-sm text-secondary" role="status" />
                    ) : (
                      <div className="btn-group btn-group-sm" role="group" aria-label="Review helpful votes">
                        <button
                          type="button"
                          className={`btn btn-sm ${
                            review.my_vote === 1 ? "btn-success" : "btn-outline-secondary"
                          }`}
                          style={
                            review.my_vote === 1
                              ? undefined
                              : { borderColor: "var(--border-color)", color: "var(--text-primary)" }
                          }
                          aria-pressed={review.my_vote === 1}
                          title="Helpful"
                          onClick={() => handleVotePress(review, 1)}
                        >
                          <i className="fas fa-thumbs-up" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${
                            review.my_vote === -1 ? "btn-danger" : "btn-outline-secondary"
                          }`}
                          style={
                            review.my_vote === -1
                              ? undefined
                              : { borderColor: "var(--border-color)", color: "var(--text-primary)" }
                          }
                          aria-pressed={review.my_vote === -1}
                          title="Unhelpful"
                          onClick={() => handleVotePress(review, -1)}
                        >
                          <i className="fas fa-thumbs-down" aria-hidden />
                        </button>
                      </div>
                    )
                  ) : null}
                  <span
                    className="small text-nowrap"
                    style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}
                  >
                    {reviewVoteLabel(review)}
                  </span>
                </div>
              </div>
              {review.owned_by_me || isAdmin ? (
                <div
                  className="card-footer d-flex flex-wrap gap-2 justify-content-end"
                  style={{
                    background: "transparent",
                    borderTop: "1px solid var(--border-color)",
                    padding: "0.75rem 1.25rem",
                  }}
                >
                  {review.owned_by_me ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-modern btn-warning-modern"
                      onClick={() => onEditReview?.(review)}
                      disabled={deletingId === review.id}
                    >
                      <i className="fas fa-edit me-1" aria-hidden />
                      Edit
                    </button>
                  ) : null}
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
