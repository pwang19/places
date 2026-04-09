import React, { useState, useEffect } from "react";
import PlaceFinder from "../../api/placesApi";

const PrivatePlaceNote = ({ placeId, privateNote, onSaved }) => {
  const [showEditor, setShowEditor] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [draft, setDraft] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const hasNote = Boolean(privateNote != null && String(privateNote).trim());

  useEffect(() => {
    if (!showEditor) return;
    setDraft(isEditMode ? String(privateNote ?? "") : "");
    setError("");
  }, [showEditor, isEditMode, privateNote]);

  const openAdd = () => {
    setIsEditMode(false);
    setDraft("");
    setError("");
    setShowEditor(true);
  };

  const openEdit = () => {
    setIsEditMode(true);
    setDraft(String(privateNote ?? ""));
    setError("");
    setShowEditor(true);
  };

  const closeEditor = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setShowEditor(false);
    setError("");
  };

  useEffect(() => {
    if (showEditor) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showEditor]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const trimmed = draft.trim();
    if (!trimmed) {
      setError("Note cannot be empty. Use Delete to remove your private note.");
      return;
    }
    setSaving(true);
    try {
      await PlaceFinder.put(`/${placeId}/private-note`, { note: trimmed });
      await onSaved?.();
      setShowEditor(false);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Could not save private note.";
      setError(String(msg));
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setError("");
    try {
      await PlaceFinder.delete(`/${placeId}/private-note`);
      await onSaved?.();
      setShowDeleteConfirm(false);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Could not delete private note.";
      setError(String(msg));
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <aside
        className="place-details-notes-panel place-details-private-notes-panel"
        aria-label="Private notes"
      >
        <h2 className="place-details-notes-heading">
          <i className="fas fa-lock me-2" aria-hidden />
          Private notes
        </h2>
        <p className="place-details-private-notes-hint mb-3">
          Only you can see or edit this note.
        </p>

        {showDeleteConfirm ? (
          <div
            className="place-details-private-notes-delete-confirm p-3 rounded mb-0"
            role="alert"
          >
            <p className="mb-3 small" style={{ color: "var(--text-heading)" }}>
              Delete your private note for this place? This cannot be undone.
            </p>
            <div className="d-flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-modern btn-secondary-modern btn-sm"
                disabled={deleting}
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-modern btn-warning-modern btn-sm"
                disabled={deleting}
                onClick={confirmDelete}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        ) : hasNote ? (
          <>
            <p className="place-details-notes-body place-details-private-notes-body mb-3">
              {privateNote}
            </p>
            <div className="d-flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-modern btn-secondary-modern btn-sm"
                onClick={openEdit}
              >
                <i className="fas fa-edit me-2" aria-hidden />
                Edit Note
              </button>
              <button
                type="button"
                className="btn btn-modern btn-warning-modern btn-sm"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <i className="fas fa-trash-alt me-2" aria-hidden />
                Delete Note
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-modern btn-primary-modern"
            onClick={openAdd}
          >
            <i className="fas fa-plus-circle me-2" aria-hidden />
            Add Private Note
          </button>
        )}
      </aside>

      {showEditor ? (
        <>
          <div
            className="modal-backdrop show"
            onClick={closeEditor}
            style={{ opacity: 0.5, zIndex: 1040 }}
          />
          <div
            className="modal show modern-modal"
            style={{ display: "block", zIndex: 1050 }}
            tabIndex={-1}
            role="dialog"
            aria-labelledby="private-note-modal-title"
            onClick={(e) => {
              if ((e.target as HTMLElement).classList.contains("modal")) {
                closeEditor(e);
              }
            }}
          >
            <div
              className="modal-dialog modal-dialog-centered modal-lg"
              role="document"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h5 className="modal-title" id="private-note-modal-title">
                    <i className="fas fa-lock me-2" aria-hidden />
                    {isEditMode ? "Edit private note" : "Add private note"}
                  </h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={closeEditor}
                    aria-label="Close"
                  />
                </div>
                <form onSubmit={handleSubmit}>
                  <div className="modal-body">
                    {error ? (
                      <div className="alert alert-danger mb-3" role="alert">
                        {error}
                      </div>
                    ) : null}
                    <label
                      htmlFor="private-note-text"
                      className="form-label"
                      style={{
                        color: "var(--text-heading)",
                        fontWeight: "600",
                      }}
                    >
                      Your note
                    </label>
                    <textarea
                      id="private-note-text"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="form-control"
                      rows={6}
                      style={{
                        background: "var(--surface)",
                        border: "2px solid var(--border-color)",
                        borderRadius: "10px",
                        color: "var(--text-primary)",
                        padding: "0.75rem 1rem",
                        resize: "vertical",
                      }}
                      placeholder="Only you will see this…"
                      autoFocus
                    />
                  </div>
                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-modern btn-secondary-modern"
                      onClick={closeEditor}
                    >
                      <i className="fas fa-times me-2" aria-hidden />
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-modern btn-primary-modern"
                      style={{ minWidth: "140px" }}
                      disabled={saving}
                    >
                      <i className="fas fa-save me-2" aria-hidden />
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
};

export default PrivatePlaceNote;
