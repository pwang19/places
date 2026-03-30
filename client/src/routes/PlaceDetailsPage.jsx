import React, { useContext, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PlaceFinder from "../apis/PlaceFinder";
import { PlacesContext } from "../context/PlacesContext";
import StarRating from "../components/StarRating";
import Reviews from "../components/Reviews";
import AddReview from "../components/AddReview";
import TagInput from "../components/TagInput";
import { normalizeTags } from "../utils/tags";

const PlaceDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { selectedPlace, setSelectedPlace, setPlaces } =
    useContext(PlacesContext);

  const mergePlaceIntoList = useCallback((placeRow) => {
    if (!placeRow) return;
    setPlaces((prev) =>
      prev.some((p) => String(p.id) === String(placeRow.id))
        ? prev.map((p) =>
            String(p.id) === String(placeRow.id) ? { ...p, ...placeRow } : p
          )
        : prev
    );
  }, [setPlaces]);

  const refreshPlace = useCallback(async () => {
    const response = await PlaceFinder.get(`/${id}`);
    setSelectedPlace(response.data.data);
    mergePlaceIntoList(response.data.data.place);
  }, [id, setSelectedPlace, mergePlaceIntoList]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await PlaceFinder.get(`/${id}`);
        setSelectedPlace(response.data.data);
      } catch (err) {
        console.log(err);
      }
    };

    fetchData();
  }, [id, setSelectedPlace]);

  return (
    <div>
      <div className="mb-4">
        <button
          onClick={() => navigate('/')}
          className="btn btn-modern btn-primary-modern"
          style={{
            borderRadius: '12px',
            padding: '0.75rem 1.5rem',
            fontWeight: '600'
          }}
        >
          <i className="fas fa-arrow-left me-2"></i>
          Back to Places
        </button>
      </div>
      {selectedPlace && (
        <>
          <div className="place-details-header">
            <h1>
              <i className="fas fa-store me-3"></i>
              {selectedPlace.place.name}
            </h1>
            <div className="rating-display justify-content-center">
              <StarRating rating={selectedPlace.place.average_rating} />
              <span className="ml-1" style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fffffa' }}>
                {selectedPlace.place.count
                  ? `(${selectedPlace.place.count} reviews)`
                  : "(0 reviews)"}
              </span>
            </div>
          </div>
          <div className="reviews-section">
            <h3 className="mb-4">
              <i className="fas fa-tags me-2"></i>
              Tags
            </h3>
            <div className="d-flex flex-wrap gap-2 mb-3">
              {normalizeTags(selectedPlace.place.tags).map((t) => (
                <span
                  key={t.id}
                  className="badge rounded-pill d-inline-flex align-items-center gap-2"
                  style={{
                    background: "rgba(255, 200, 87, 0.25)",
                    color: "#fffffa",
                    fontSize: "0.9rem",
                    padding: "0.45em 0.75em",
                  }}
                >
                  {t.name}
                  <button
                    type="button"
                    className="btn btn-sm btn-link p-0 m-0 text-white-50"
                    style={{ lineHeight: 1, textDecoration: "none" }}
                    title="Remove tag"
                    aria-label={`Remove tag ${t.name}`}
                    onClick={async () => {
                      try {
                        await PlaceFinder.delete(`/${id}/tags/${t.id}`);
                        await refreshPlace();
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
            <TagInput
              id="place-detail-tag-input"
              placeholder="Add a tag (type, optional suggestion click, then Enter)"
              onSubmitName={async (name) => {
                await PlaceFinder.post(`/${id}/tags`, { name });
                await refreshPlace();
              }}
            />
          </div>
          <div className="reviews-section">
            <h3 className="mb-4">
              <i className="fas fa-comments me-2"></i>
              Reviews
            </h3>
            <Reviews reviews={selectedPlace.reviews} />
          </div>
          <div className="reviews-section">
            <h3 className="mb-4">
              <i className="fas fa-plus-circle me-2"></i>
              Add Review
            </h3>
            <AddReview />
          </div>
        </>
      )}
    </div>
  );
};

export default PlaceDetailsPage;
