import React, { useState } from "react";
import PlaceFinder from "../apis/PlaceFinder";
import { useParams } from "react-router-dom";

const AddReviews = () => {
  const { id } = useParams();
 

  const [name, setName] = useState("");
  const [rating, setRating] = useState("Rating");
  const [reviewText, setReviewText] = useState("");

  const handleSubmitReview = async (e) => {
    // prevent page from reloading
    e.preventDefault();
    try {
      const response = await PlaceFinder.post(`/${id}/addReview`, {
        name: name,
        review: reviewText,
        rating: rating,
      });
      window.location.reload(false) ;
      
    } catch (err) {}
  };

  return (
    <form className="row g-3" onSubmit={handleSubmitReview}>
      <div className="col-md-7">
        <label htmlFor="name" className="form-label" style={{ color: '#fffffa', fontWeight: '600' }}>
          <i className="fas fa-user me-2"></i>
          Your Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          type="text"
          className="form-control"
          id="name"
          style={{
            background: 'rgba(255, 255, 250, 0.1)',
            border: '2px solid rgba(23, 126, 137, 0.3)',
            borderRadius: '10px',
            color: '#fffffa',
            padding: '0.75rem 1rem'
          }}
          placeholder="Enter your name"
          required
        />
      </div>
      <div className="col-md-5">
        <label htmlFor="rating" className="form-label" style={{ color: '#fffffa', fontWeight: '600' }}>
          <i className="fas fa-star me-2"></i>
          Rating
        </label>
        <select
          value={rating}
          onChange={(e) => setRating(e.target.value)}
          id="rating"
          className="form-select"
          style={{
            background: 'rgba(255, 255, 250, 0.1)',
            border: '2px solid rgba(23, 126, 137, 0.3)',
            borderRadius: '10px',
            color: '#fffffa',
            padding: '0.75rem 1rem'
          }}
          required
        >
          <option value="Rating" disabled>Select Rating</option>
          <option value="1">⭐ 1 Star</option>
          <option value="2">⭐⭐ 2 Stars</option>
          <option value="3">⭐⭐⭐ 3 Stars</option>
          <option value="4">⭐⭐⭐⭐ 4 Stars</option>
          <option value="5">⭐⭐⭐⭐⭐ 5 Stars</option>
        </select>
      </div>
      <div className="col-12">
        <label htmlFor="reviewtext" className="form-label" style={{ color: '#fffffa', fontWeight: '600' }}>
          <i className="fas fa-comment me-2"></i>
          Your Review
        </label>
        <textarea
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          id="reviewtext"
          className="form-control"
          rows="4"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '2px solid rgba(102, 126, 234, 0.3)',
            borderRadius: '10px',
            color: '#ffffff',
            padding: '0.75rem 1rem',
            resize: 'vertical'
          }}
          placeholder="Share your experience..."
          required
        ></textarea>
      </div>
      <div className="col-12">
        <button
          type="submit"
          className="btn btn-modern btn-primary-modern"
          style={{ minWidth: '150px' }}
        >
          <i className="fas fa-paper-plane me-2"></i>
          Submit Review
        </button>
      </div>
    </form>
  );
};

export default AddReviews;
