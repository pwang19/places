import React from "react";

const StarRating = ({ rating }) => {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (i <= rating) {
      stars.push(<i key={i} className="fa-solid fa-star" style={{ color: '#ffc857' }}></i>);
    } else if (i === Math.ceil(rating) && !Number.isInteger(rating)) {
      stars.push(<i key={i} className="fa-regular fa-star-half-stroke" style={{ color: '#ffc857' }}></i>);
    } else {
      stars.push(<i key={i} className="fa-regular fa-star" style={{ color: '#ffc857' }}></i>);
    }
  }
  return <>{stars}</>;
};

export default StarRating;
