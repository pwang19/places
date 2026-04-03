import React, { useContext, useEffect, useCallback, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PlaceFinder from "../apis/PlaceFinder";
import { PlacesContext } from "../context/PlacesContext";
import StarRating from "../components/StarRating";
import Reviews from "../components/Reviews";
import AddReview from "../components/AddReview";
import UpdatePlace from "../components/UpdatePlace";
import { normalizeTags } from "../utils/tags";
import { formatPriceRangeDollars } from "../utils/priceRange";

const PlaceDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { selectedPlace, setSelectedPlace, setPlaces } =
    useContext(PlacesContext);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showAddReviewModal, setShowAddReviewModal] = useState(false);

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

  const reloadPlace = useCallback(async () => {
    if (!id) return;
    try {
      const response = await PlaceFinder.get(`/${id}`);
      setSelectedPlace(response.data.data);
      mergePlaceIntoList(response.data.data.place);
    } catch (err) {
      console.error(err);
    }
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

  const detailPriceLabel = selectedPlace
    ? formatPriceRangeDollars(selectedPlace.place.price_range)
    : null;

  return (
    <div>
      <div className="place-details-toolbar mb-4 d-flex justify-content-between align-items-center flex-wrap gap-2">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="btn btn-modern btn-primary-modern"
          style={{
            borderRadius: "12px",
            padding: "0.75rem 1.5rem",
            fontWeight: "600",
          }}
        >
          <i className="fas fa-arrow-left me-2"></i>
          Back to Places
        </button>
        {id ? (
          <div className="d-flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowUpdateModal(true)}
              className="btn btn-modern btn-warning-modern"
              style={{
                borderRadius: "12px",
                padding: "0.75rem 1.5rem",
                fontWeight: "600",
              }}
              title="Edit place"
            >
              <i className="fas fa-edit me-2"></i>
              Edit
            </button>
            <button
              type="button"
              onClick={() => setShowAddReviewModal(true)}
              className="btn btn-modern btn-secondary-modern"
              style={{
                borderRadius: "12px",
                padding: "0.75rem 1.5rem",
                fontWeight: "600",
              }}
              title="Add a review"
            >
              <i className="fas fa-plus-circle me-2"></i>
              Add Review
            </button>
          </div>
        ) : null}
      </div>
      <AddReview
        showModal={showAddReviewModal}
        onClose={() => setShowAddReviewModal(false)}
        onSuccess={reloadPlace}
      />
      <UpdatePlace
        showModal={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        placeId={id}
        onUpdated={(placeRow) => {
          setSelectedPlace((sp) =>
            sp && String(sp.place?.id) === String(placeRow.id)
              ? { ...sp, place: placeRow }
              : sp
          );
          mergePlaceIntoList(placeRow);
        }}
        onDeleted={() => {
          setSelectedPlace(null);
          navigate("/");
        }}
      />
      {selectedPlace && (
        <>
          <div
            className={`place-details-hero${
              selectedPlace.place.notes?.trim()
                ? " place-details-hero--with-notes"
                : ""
            }`}
          >
            <div
              className={`place-details-header${
                selectedPlace.place.location?.trim()
                  ? " place-details-header--has-address"
                  : ""
              }`}
            >
              <h1>
                <i className="fas fa-store me-3"></i>
                {selectedPlace.place.name}
              </h1>
              {detailPriceLabel ? (
                <p className="place-details-price-range mb-0">
                  <span className="visually-hidden">Price range: </span>
                  {detailPriceLabel}
                </p>
              ) : null}
              {selectedPlace.place.location?.trim() ? (
                <p className="place-details-address mb-0">
                  <i className="fas fa-map-marker-alt me-2" aria-hidden />
                  {selectedPlace.place.location}
                </p>
              ) : null}
              {normalizeTags(selectedPlace.place.tags).length > 0 ? (
                <div
                  className="place-details-tags-readonly d-flex flex-wrap justify-content-center gap-2"
                  aria-label="Tags"
                >
                  {normalizeTags(selectedPlace.place.tags).map((t) => (
                    <span
                      key={t.id}
                      className="badge rounded-pill place-details-tag-pill"
                    >
                      {t.name}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="rating-display justify-content-center">
                <StarRating rating={selectedPlace.place.average_rating} />
                <span
                  className="ml-1"
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: "600",
                    color: "var(--text-muted)",
                  }}
                >
                  {selectedPlace.place.count
                    ? `(${selectedPlace.place.count} reviews)`
                    : "(0 reviews)"}
                </span>
              </div>
            </div>
            {selectedPlace.place.notes?.trim() ? (
              <aside
                className="place-details-notes-panel"
                aria-label="Place notes"
              >
                <h2 className="place-details-notes-heading">
                  <i className="fas fa-sticky-note me-2" aria-hidden />
                  Notes
                </h2>
                <p className="place-details-notes-body mb-0">
                  {selectedPlace.place.notes}
                </p>
              </aside>
            ) : null}
          </div>
          <div className="reviews-section">
            <h3 className="mb-4">
              <i className="fas fa-comments me-2"></i>
              Reviews
            </h3>
            <Reviews reviews={selectedPlace.reviews} />
          </div>
        </>
      )}
    </div>
  );
};

export default PlaceDetailsPage;
