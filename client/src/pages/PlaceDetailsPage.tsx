import React, { useEffect, useCallback, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PlaceFinder from "../api/placesApi";
import { usePlacesContext } from "../context/PlacesContext";
import StarRating from "../components/ui/StarRating";
import Reviews from "../features/places/Reviews";
import AddReview from "../features/places/AddReview";
import UpdatePlace from "../features/places/UpdatePlace";
import PlaceFlagsModal from "../features/places/PlaceFlagsModal";
import PrivatePlaceNote from "../features/places/PrivatePlaceNote";
import UserMenu from "../features/auth/UserMenu";
import EditAdminsControl from "../features/auth/EditAdminsControl";
import { useAuth } from "../context/AuthContext";
import { normalizeTags } from "../utils/tags";
import { formatPriceRangeDollars } from "../utils/priceRange";
import { cleanStringList, websiteHref } from "../utils/contactInfo";

const googleMapsUrlForQuery = (query) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    query.trim()
  )}`;

const PlaceDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { selectedPlace, setSelectedPlace, setPlaces } = usePlacesContext();
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showAddReviewModal, setShowAddReviewModal] = useState(false);
  const [editingReview, setEditingReview] = useState(null);
  const [showFlagsModal, setShowFlagsModal] = useState(false);

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
  const hasMyReview = Boolean(
    selectedPlace?.reviews?.some((r) => r.owned_by_me)
  );

  const detailPhone =
    selectedPlace?.place?.phone != null
      ? String(selectedPlace.place.phone).trim()
      : "";
  const detailEmails = selectedPlace?.place
    ? cleanStringList(selectedPlace.place.emails)
    : [];
  const detailWebsites = selectedPlace?.place
    ? cleanStringList(selectedPlace.place.websites)
    : [];
  const hasContactBlock =
    Boolean(detailPhone) ||
    detailEmails.length > 0 ||
    detailWebsites.length > 0;

  const flagCount = Number(selectedPlace?.place?.flag_count) || 0;

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
        <div className="ms-auto d-flex align-items-center flex-shrink-0 gap-2">
          <EditAdminsControl />
          <UserMenu />
        </div>
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
        isAdmin={isAdmin}
        onUpdated={(placeRow) => {
          mergePlaceIntoList(placeRow);
          reloadPlace();
        }}
        onDeleted={() => {
          setSelectedPlace(null);
          setPlaces((prev) =>
            prev.filter((p) => String(p.id) !== String(id))
          );
          navigate("/");
        }}
      />
      <PlaceFlagsModal
        showModal={showFlagsModal}
        onClose={() => setShowFlagsModal(false)}
        placeId={id}
        placeName={selectedPlace?.place?.name}
        isAdmin={isAdmin}
        onFlagsChanged={reloadPlace}
        onPlaceDeleted={() => {
          setSelectedPlace(null);
          setPlaces((prev) =>
            prev.filter((p) => String(p.id) !== String(id))
          );
          navigate("/");
        }}
      />
      {selectedPlace && (
        <>
          <div className="place-details-hero place-details-hero--with-side-panel">
            <div
              className={`place-details-header${
                detailPriceLabel || selectedPlace.place.location?.trim()
                  ? " place-details-header--has-address"
                  : ""
              }`}
            >
              {flagCount > 0 ? (
                <div
                  className="alert alert-warning d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3 w-100"
                  role="status"
                >
                  <span className="mb-0 d-flex align-items-center">
                    <i className="fas fa-flag text-danger me-2" aria-hidden />
                    This place has been flagged for review.
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-dark flex-shrink-0"
                    onClick={() => setShowFlagsModal(true)}
                  >
                    View Flag
                  </button>
                </div>
              ) : null}
              <div className="place-details-title-row">
                <h1 className="place-details-title-heading mb-0">
                  {selectedPlace.place.name}
                </h1>
                {id ? (
                  <button
                    type="button"
                    onClick={() => setShowUpdateModal(true)}
                    className="btn btn-modern btn-warning-modern place-details-title-edit flex-shrink-0"
                    style={{
                      borderRadius: "12px",
                      padding: "0.5rem 1.1rem",
                      fontWeight: "600",
                    }}
                    title="Edit place"
                  >
                    <i className="fas fa-edit me-2"></i>
                    Edit
                  </button>
                ) : null}
              </div>
              {detailPriceLabel || selectedPlace.place.location?.trim() ? (
                <div className="place-details-price-location-row">
                  {detailPriceLabel ? (
                    <span className="place-details-price-range place-details-price-range--inline">
                      <span className="visually-hidden">Price range: </span>
                      {detailPriceLabel}
                    </span>
                  ) : null}
                  {detailPriceLabel && selectedPlace.place.location?.trim() ? (
                    <span
                      className="place-details-price-location-sep"
                      aria-hidden
                    >
                      ·
                    </span>
                  ) : null}
                  {selectedPlace.place.location?.trim() ? (
                    <span className="place-details-address place-details-address--inline">
                      <i
                        className="fas fa-map-marker-alt me-2"
                        aria-hidden
                      />
                      <a
                        href={googleMapsUrlForQuery(
                          selectedPlace.place.location
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="place-details-address-link"
                        title="Open in Google Maps"
                      >
                        {selectedPlace.place.location}
                      </a>
                    </span>
                  ) : null}
                </div>
              ) : null}
              {normalizeTags(selectedPlace.place.tags).length > 0 ? (
                <div
                  className="place-details-tags-readonly d-flex flex-wrap justify-content-start gap-2 mt-3 w-100"
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
              {hasContactBlock ? (
                <div className="place-details-contact w-100 text-start mt-3">
                  {detailPhone ? (
                    <p className="place-details-contact-line mb-1">
                      <i className="fas fa-phone me-2" aria-hidden />
                      <a
                        href={`tel:${detailPhone.replace(/\s/g, "")}`}
                        className="place-details-address-link"
                      >
                        {detailPhone}
                      </a>
                    </p>
                  ) : null}
                  {detailEmails.map((email) => (
                    <p
                      key={email}
                      className="place-details-contact-line mb-1"
                    >
                      <i className="fas fa-envelope me-2" aria-hidden />
                      <a
                        href={`mailto:${encodeURIComponent(email)}`}
                        className="place-details-address-link"
                      >
                        {email}
                      </a>
                    </p>
                  ))}
                  {detailWebsites.map((rawUrl) => {
                    const href = websiteHref(rawUrl);
                    if (!href) return null;
                    const label = String(rawUrl).trim();
                    return (
                      <p
                        key={label}
                        className="place-details-contact-line mb-1"
                      >
                        <i className="fas fa-globe me-2" aria-hidden />
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="place-details-address-link"
                        >
                          {label}
                        </a>
                      </p>
                    );
                  })}
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
            </div>
            <PrivatePlaceNote
              placeId={id}
              privateNote={selectedPlace.place.private_note}
              onSaved={reloadPlace}
            />
          </div>
          {!reviewsDisabled ? (
            <div className="reviews-section">
              <div className="reviews-section-header">
                <div className="reviews-section-title-row">
                  <h3 className="reviews-section-heading mb-0">
                    <i className="fas fa-comments me-2" aria-hidden></i>
                    Reviews
                  </h3>
                  <div
                    className="rating-display reviews-section-rating"
                    aria-label={`Average rating ${
                      selectedPlace.place.average_rating ?? 0
                    } out of 5`}
                  >
                    <StarRating rating={selectedPlace.place.average_rating} />
                    <span className="reviews-section-review-count">
                      {selectedPlace.place.count
                        ? `(${selectedPlace.place.count} reviews)`
                        : "(0 reviews)"}
                    </span>
                  </div>
                </div>
                {!hasMyReview ? (
                  <button
                    type="button"
                    onClick={openAddReview}
                    className="btn btn-modern btn-secondary-modern reviews-section-add-btn flex-shrink-0"
                    style={{
                      borderRadius: "12px",
                      padding: "0.5rem 1.1rem",
                      fontWeight: "600",
                    }}
                    title="Add a review"
                  >
                    <i className="fas fa-plus-circle me-2"></i>
                    Add Review
                  </button>
                ) : null}
              </div>
              <Reviews
                reviews={selectedPlace.reviews}
                placeId={id}
                isAdmin={isAdmin}
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
