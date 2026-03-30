import React from "react";
import StarRating from "./StarRating";

const Reviews = ({ reviews }) => {
  if (!reviews || reviews.length === 0) {
    return (
      <div className="text-center py-5">
        <i className="fas fa-comment-slash fa-3x mb-3" style={{ color: '#ffc857' }}></i>
        <p style={{ color: '#ffc857' }}>No reviews yet. Be the first to review!</p>
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
                background: 'linear-gradient(135deg, rgba(23, 126, 137, 0.1) 0%, rgba(8, 76, 97, 0.1) 100%)',
                border: '1px solid rgba(23, 126, 137, 0.3)',
                borderRadius: '15px',
                boxShadow: '0 4px 16px rgba(8, 76, 97, 0.3)',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-5px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(8, 76, 97, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(8, 76, 97, 0.3)';
              }}
            >
              <div 
                className="card-header d-flex justify-content-between align-items-center"
                style={{
                  background: 'linear-gradient(135deg, #177e89 0%, #084c61 100%)',
                  border: 'none',
                  borderRadius: '15px 15px 0 0',
                  padding: '1rem 1.25rem'
                }}
              >
                <span style={{ fontWeight: '600', color: 'white' }}>
                  <i className="fas fa-user me-2"></i>
                  {review.name}
                </span>
                <span>
                  <StarRating rating={review.rating} />
                </span>
              </div>
              <div className="card-body" style={{ padding: '1.25rem' }}>
                <p className="card-text" style={{ color: '#fffffa', margin: 0, lineHeight: '1.6' }}>
                  {review.review}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Reviews;
