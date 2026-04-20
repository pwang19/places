import React, { useEffect, useState } from "react";
import {
  EXPORT_OPTIONAL_FIELD_IDS,
  type ExportOptionalFieldId,
} from "../../utils/exportPlacesCsv";

type ExportPlacesCsvModalProps = {
  open: boolean;
  onClose: () => void;
  placeCount: number;
  onConfirm: (optional: Set<ExportOptionalFieldId>) => void;
};

const OPTIONAL_LABELS: Record<ExportOptionalFieldId, string> = {
  notes: "Public notes",
  price: "Price",
  rating: "Rating",
  tags: "Tags",
  phone: "Phone",
  emails: "Emails",
  websites: "Websites",
};

export default function ExportPlacesCsvModal({
  open,
  onClose,
  placeCount,
  onConfirm,
}: ExportPlacesCsvModalProps) {
  const [selected, setSelected] = useState<Set<ExportOptionalFieldId>>(
    () => new Set(EXPORT_OPTIONAL_FIELD_IDS)
  );

  useEffect(() => {
    if (open) {
      setSelected(new Set(EXPORT_OPTIONAL_FIELD_IDS));
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [open]);

  if (!open) return null;

  const toggle = (id: ExportOptionalFieldId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleClose = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    onClose();
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(selected);
  };

  return (
    <>
      <div
        className="modal-backdrop show"
        onClick={() => handleClose()}
        style={{ opacity: 0.5, zIndex: 1040 }}
        aria-hidden
      />
      <div
        className="modal show modern-modal"
        style={{ display: "block", zIndex: 1050 }}
        tabIndex={-1}
        role="dialog"
        aria-labelledby="exportPlacesCsvTitle"
        onClick={(e) => {
          if ((e.target as HTMLElement).classList.contains("modal")) {
            handleClose(e);
          }
        }}
      >
        <div
          className="modal-dialog modal-dialog-centered"
          role="document"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h5 className="modal-title" id="exportPlacesCsvTitle">
                <i className="fas fa-file-csv me-2" aria-hidden />
                Export to CSV
              </h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={(e) => handleClose(e)}
                aria-label="Close"
              />
            </div>
            <form onSubmit={handleConfirm} noValidate>
              <div className="modal-body">
                <p className="text-muted small mb-3">
                  Exports the <strong>current list</strong>
                  {placeCount > 0 ? (
                    <>
                      {" "}
                      ({placeCount} place{placeCount === 1 ? "" : "s"})
                    </>
                  ) : null}
                  : same filters, sort, and name search as on screen.
                </p>
                <p className="small fw-semibold mb-2">Always included</p>
                <ul className="small text-muted mb-3 ps-3">
                  <li>Place name</li>
                  <li>Location</li>
                </ul>
                <p className="small fw-semibold mb-2">Optional columns</p>
                <div className="d-flex flex-column gap-2">
                  {EXPORT_OPTIONAL_FIELD_IDS.map((id) => (
                    <label
                      key={id}
                      className="d-flex align-items-center gap-2 mb-0 small"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(id)}
                        onChange={() => toggle(id)}
                      />
                      {OPTIONAL_LABELS[id]}
                    </label>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-modern btn-secondary-modern"
                  onClick={(e) => handleClose(e)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-modern btn-primary-modern"
                  disabled={placeCount === 0}
                >
                  Download CSV
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
