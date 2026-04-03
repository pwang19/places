import React, { useContext, useEffect, useCallback, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PlaceFinder from "../apis/PlaceFinder";
import { PlacesContext } from "../context/PlacesContext";
import StarRating from "../components/StarRating";
import Reviews from "../components/Reviews";
import AddReview from "../components/AddReview";
import UpdatePlace from "../components/UpdatePlace";
import PrivatePlaceNote from "../components/PrivatePlaceNote";
import UserMenu from "../components/UserMenu";
import { normalizeTags } from "../utils/tags";
import { formatPriceRangeDollars } from "../utils/priceRange";

const googleMapsUrlForQuery = (query) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    query.trim()
  )}`;

const PlaceDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { selectedPlace, setSelectedPlace, setPlaces } =
    useContext(PlacesContext);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showAddReviewModal, setShowAddReviewModal] = useState(false);
  const [editingReview, setEditingReview] = useState(null);

  const closeReviewModal = () => {
    setShowAddReviewModal(false);
    setEditingReview(null);
  };

  const openAddReview = () => {
    setEditingReview(null);
    setShowAddReviewModal(true);
  };

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

  const reviewsDisabled = Boolean(selectedPlace?.place?.reviews_disabled);

  return (
    <div>
      <div className="place-details-toolbar mb-4 d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div className="d-flex flex-wrap gap-2 align-items-center">
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
          <UserMenu />
        </div>
        {id ? (
          <div className="d-flex flex-wrap gap-2 align-items-center">
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
            {!reviewsDisabled ? (
              <button
                type="button"
                onClick={openAddReview}
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
            ) : null}
          </div>
        ) : null}
      </div>
      {!reviewsDisabled ? (
        <AddReview
          showModal={showAddReviewModal || editingReview != null}
          onClose={closeReviewModal}
          onSuccess={reloadPlace}
          editingReview={editingReview}
        />
      ) : null}
      <UpdatePlace
        showModal={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        placeId={id}
        onUpdated={(placeRow) => {
          mergePlaceIntoList(placeRow);
          reloadPlace();
        }}
        onDeleted={() => {
          setSelectedPlace(null);
          navigate("/");
        }}
      />
      {selectedPlace && (
        <>
          <div className="place-details-hero place-details-hero--with-side-panel">
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
                  <a
                    href={googleMapsUrlForQuery(selectedPlace.place.location)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="place-details-address-link"
                    title="Open in Google Maps"
                  >
                    {selectedPlace.place.location}
                  </a>
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
              {selectedPlace.place.notes?.trim() ? (
                <div className="place-details-public-notes mt-4 text-start w-100">
                  <h3 className="place-details-public-notes-heading">
                    <i className="fas fa-sticky-note me-2" aria-hidden />
                    Public notes
                  </h3>
                  <p className="place-details-notes-body place-details-public-notes-body mb-0">
                    {selectedPlace.place.notes}
                  </p>
                </div>
              ) : null}
              {!reviewsDisabled ? (
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
              ) : null}
            </div>
            <PrivatePlaceNote
              placeId={id}
              privateNote={selectedPlace.place.private_note}
              onSaved={reloadPlace}
            />
          </div>
          {!reviewsDisabled ? (
            <div className="reviews-section">
              <h3 className="mb-4">
                <i className="fas fa-comments me-2"></i>
                Reviews
              </h3>
              <Reviews
                reviews={selectedPlace.reviews}
                placeId={id}
                onReviewsChanged={reloadPlace}
                onEditReview={(r) => {
                  setShowAddReviewModal(false);
                  setEditingReview({
                    id: r.id,
                    review: r.review,
                    rating: r.rating,
                  });
                }}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};

export default PlaceDetailsPage;
