import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import StarRating from "../../components/ui/StarRating";
import { formatPriceRangeDollars } from "../../utils/priceRange";

export type RelatedPlaceCard = {
  id: number | string;
  name: string;
  location: string;
  price_range?: number | null;
  reviews_disabled?: boolean;
  count?: number | null;
  average_rating?: number | null;
};

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const RelatedPlacesCarousel = ({ places }: { places: RelatedPlaceCard[] }) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [showArrows, setShowArrows] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const scrollable = maxScroll > 4;
    setShowArrows(scrollable);
    setCanPrev(scrollable && el.scrollLeft > 4);
    setCanNext(scrollable && el.scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    updateScrollState();
  }, [places, updateScrollState]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => updateScrollState());
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateScrollState]);

  const scrollPage = (direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const behavior = prefersReducedMotion() ? "auto" : "smooth";
    el.scrollBy({ left: direction * el.clientWidth, behavior });
  };

  if (!places.length) return null;

  return (
    <div className="related-places-section">
      <h3 className="reviews-section-heading mb-3">
        <i className="fas fa-link me-2" aria-hidden />
        Related To
      </h3>
      <div className="related-carousel">
        {showArrows ? (
          <button
            type="button"
            className="related-carousel-arrow related-carousel-arrow--prev"
            onClick={() => scrollPage(-1)}
            disabled={!canPrev}
            aria-label="Show previous related places"
          >
            <i className="fas fa-chevron-left" aria-hidden />
          </button>
        ) : null}
        <div
          ref={scrollerRef}
          className="related-carousel-viewport"
          onScroll={updateScrollState}
          role="list"
          aria-label="Related places"
        >
          <div className="related-carousel-track">
            {places.map((p) => {
              const id = String(p.id);
              const priceLabel = formatPriceRangeDollars(p.price_range);
              const showRating =
                !p.reviews_disabled &&
                p.average_rating != null &&
                Number(p.count) > 0;
              return (
                <div key={id} className="related-carousel-cell" role="listitem">
                  <Link
                    to={`/places/${id}`}
                    className="related-carousel-card place-tile"
                  >
                    <div className="related-carousel-card-main place-tile-main">
                      <h4 className="place-tile-name related-carousel-card-title">
                        {p.name}
                      </h4>
                      {priceLabel ? (
                        <p className="place-tile-price-range mb-1">{priceLabel}</p>
                      ) : null}
                      <p className="place-tile-location mb-0">
                        <i
                          className="fas fa-map-marker-alt place-tile-location-icon"
                          aria-hidden
                        />
                        <span>{p.location}</span>
                      </p>
                      {showRating ? (
                        <div className="place-tile-rating rating-display mt-2">
                          <StarRating rating={p.average_rating} />
                        </div>
                      ) : null}
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
        {showArrows ? (
          <button
            type="button"
            className="related-carousel-arrow related-carousel-arrow--next"
            onClick={() => scrollPage(1)}
            disabled={!canNext}
            aria-label="Show more related places"
          >
            <i className="fas fa-chevron-right" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default RelatedPlacesCarousel;
