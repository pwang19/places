import React, { useEffect, useState } from "react";
import PlaceFinder, {
  dismissPlaceFlagsRpc,
  getPlaceFlagsRpc,
} from "../../api/placesApi";

type FlagRow = {
  id?: number;
  reason?: string;
  created_at?: string;
  flagged_by?: string;
};

function formatFlagTime(iso?: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

type PlaceFlagsModalProps = {
  showModal: boolean;
  onClose: () => void;
  placeId: string | undefined;
  placeName?: string;
  isAdmin: boolean;
  onFlagsChanged: () => void | Promise<void>;
  onPlaceDeleted: () => void;
};

export default function PlaceFlagsModal({
  showModal,
  onClose,
  placeId,
  placeName,
  isAdmin,
  onFlagsChanged,
  onPlaceDeleted,
}: PlaceFlagsModalProps) {
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!showModal || !placeId) return undefined;
    let cancelled = false;
    setLoadError("");
    setActionError("");
    setLoading(true);
    getPlaceFlagsRpc(placeId)
      .then((rows) => {
        if (!cancelled) setFlags(Array.isArray(rows) ? rows : []);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(
            err.response?.data?.message || err.message || "Could not load flags"
          );
          setFlags([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showModal, placeId]);

  useEffect(() => {
    if (!showModal) return undefined;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showModal]);

  const handleDismiss = async () => {
    if (!placeId) return;
    setActionError("");
    setBusy(true);
    try {
      await dismissPlaceFlagsRpc(placeId);
      await onFlagsChanged();
      onClose();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ||
        (err as Error)?.message ||
        "Could not dismiss flags.";
      setActionError(String(msg));
    } finally {
      setBusy(false);
    }
  };

  const handleDeletePlace = async () => {
    if (!placeId) return;
    if (
      !window.confirm(
        `Delete "${placeName?.trim() || "this place"}" permanently? This cannot be undone.`
      )
    ) {
      return;
    }
    setActionError("");
    setBusy(true);
    try {
      await PlaceFinder.delete(`/${placeId}`);
      onPlaceDeleted();
      onClose();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ||
        (err as Error)?.message ||
        "Could not delete place.";
      setActionError(String(msg));
    } finally {
      setBusy(false);
    }
  };

  if (!showModal) return null;

  return (
    <>
      <div
        className="modal-backdrop show"
        onClick={() => !busy && onClose()}
        style={{ opacity: 0.5, zIndex: 1040 }}
        aria-hidden
      />
      <div
        className="modal show modern-modal"
        style={{ display: "block", zIndex: 1050 }}
        tabIndex={-1}
        role="dialog"
        aria-labelledby="place-flags-modal-title"
        onClick={(e) => {
          if (
            !busy &&
            (e.target as HTMLElement).classList.contains("modal")
          ) {
            onClose();
          }
        }}
      >
        <div
          className="modal-dialog modal-dialog-centered modal-dialog-scrollable"
          role="document"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="place-flags-modal-title">
                <i className="fas fa-flag me-2 text-danger" aria-hidden />
                Flag reports
              </h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={() => !busy && onClose()}
                aria-label="Close"
                disabled={busy}
              />
            </div>
            <div className="modal-body">
              {loadError ? (
                <div className="alert alert-danger" role="alert">
                  {loadError}
                </div>
              ) : null}
              {actionError ? (
                <div className="alert alert-danger" role="alert">
                  {actionError}
                </div>
              ) : null}
              {loading ? (
                <p className="text-muted mb-0">Loading…</p>
              ) : flags.length === 0 ? (
                <p className="text-muted mb-0">No flag reports for this place.</p>
              ) : (
                <ul className="list-unstyled mb-0">
                  {flags.map((f, i) => (
                    <li
                      key={f.id ?? i}
                      className="mb-3 pb-3 border-bottom border-secondary border-opacity-25"
                    >
                      <p className="mb-1">{f.reason}</p>
                      <p className="small text-muted mb-0">
                        {f.flagged_by ? (
                          <>
                            <span className="fw-semibold">{f.flagged_by}</span>
                            {" · "}
                          </>
                        ) : null}
                        {formatFlagTime(f.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="modal-footer flex-wrap gap-2">
              {isAdmin ? (
                <>
                  <button
                    type="button"
                    className="btn btn-modern btn-secondary-modern"
                    onClick={handleDismiss}
                    disabled={busy || loading || flags.length === 0}
                  >
                    Dismiss flag
                  </button>
                  <button
                    type="button"
                    className="btn btn-modern btn-danger-modern"
                    onClick={handleDeletePlace}
                    disabled={busy || loading}
                  >
                    Delete place
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="btn btn-modern btn-primary-modern ms-auto"
                onClick={() => onClose()}
                disabled={busy}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
