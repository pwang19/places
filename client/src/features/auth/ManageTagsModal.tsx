import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import PlaceFinder, {
  adminDeleteTag,
  adminMergeTags,
  adminRenameTag,
  listAllTags,
} from "../../api/placesApi";
import { usePlacesContext } from "../../context/PlacesContext";

type TagRow = { id: number; name: string };

type ManageTagsModalProps = {
  showModal: boolean;
  onClose: () => void;
};

const TAGS_PAGE_SIZE = 10;

function errMessage(err: unknown): string {
  const e = err as { response?: { data?: { message?: string } }; message?: string };
  return String(e?.response?.data?.message || e?.message || "Request failed");
}

export default function ManageTagsModal({ showModal, onClose }: ManageTagsModalProps) {
  const location = useLocation();
  const { reloadPlaces, selectedPlace, setSelectedPlace, setPlaces } = usePlacesContext();
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [mergeKeepId, setMergeKeepId] = useState<number | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [renameId, setRenameId] = useState<number | null>(null);
  const [renameText, setRenameText] = useState("");
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const loadTags = useCallback(async () => {
    setLoadError("");
    setLoading(true);
    try {
      const rows = await listAllTags();
      setTags(
        (Array.isArray(rows) ? rows : []).map((r) => ({
          id: Number(r.id),
          name: String(r.name ?? ""),
        }))
      );
    } catch (err) {
      setLoadError(errMessage(err));
      setTags([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!showModal) return undefined;
    loadTags();
    setSelected({});
    setMergeOpen(false);
    setMergeKeepId(null);
    setRenameId(null);
    setRenameText("");
    setActionError("");
    setSearchQuery("");
    setPage(1);
    return undefined;
  }, [showModal, loadTags]);

  useEffect(() => {
    if (!showModal) return undefined;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showModal]);

  const afterTagMutation = useCallback(async () => {
    await loadTags();
    reloadPlaces();
    if (location.pathname.startsWith("/places/")) {
      try {
        const response = await PlaceFinder.get("/");
        setPlaces(response.data.data.places);
      } catch {
        /* ignore */
      }
    }
    const pid = selectedPlace?.place?.id;
    if (pid != null) {
      try {
        const res = await PlaceFinder.get(`/${pid}`);
        setSelectedPlace(res.data.data);
        const placeRow = res.data.data?.place;
        if (placeRow) {
          setPlaces((prev) =>
            prev.some((p) => String(p.id) === String(placeRow.id))
              ? prev.map((p) =>
                  String(p.id) === String(placeRow.id) ? { ...p, ...placeRow } : p
                )
              : prev
          );
        }
      } catch {
        /* ignore */
      }
    }
  }, [
    loadTags,
    reloadPlaces,
    location.pathname,
    selectedPlace?.place?.id,
    setPlaces,
    setSelectedPlace,
  ]);

  const selectedIds = useMemo(
    () =>
      Object.entries(selected)
        .filter(([, v]) => v)
        .map(([k]) => Number(k))
        .filter((n) => Number.isFinite(n)),
    [selected]
  );

  useEffect(() => {
    if (mergeOpen && selectedIds.length < 2) {
      setMergeOpen(false);
      setMergeKeepId(null);
    }
  }, [mergeOpen, selectedIds.length]);

  useEffect(() => {
    if (!mergeOpen || selectedIds.length < 2) return;
    if (mergeKeepId != null && !selectedIds.includes(mergeKeepId)) {
      setMergeKeepId(selectedIds[0]);
    }
  }, [mergeOpen, mergeKeepId, selectedIds]);

  /** Checked tags stay at top and ignore search. */
  const pinnedTags = useMemo(() => {
    return tags
      .filter((t) => selected[t.id])
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [tags, selected]);

  /** Unselected tags only; search applies here, not to pinned rows. */
  const filteredUnselectedTags = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const unselected = tags.filter((t) => !selected[t.id]);
    if (!q) return unselected;
    return unselected.filter((t) => t.name.toLowerCase().includes(q));
  }, [tags, searchQuery, selected]);

  const hasUnselectedTags = useMemo(
    () => tags.some((t) => !selected[t.id]),
    [tags, selected]
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredUnselectedTags.length / TAGS_PAGE_SIZE) || 1
  );
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  const pageUnselectedTags = useMemo(() => {
    const offset = (safePage - 1) * TAGS_PAGE_SIZE;
    return filteredUnselectedTags.slice(offset, offset + TAGS_PAGE_SIZE);
  }, [filteredUnselectedTags, safePage]);

  const rangeStart =
    filteredUnselectedTags.length === 0
      ? 0
      : (safePage - 1) * TAGS_PAGE_SIZE + 1;
  const rangeEnd = Math.min(
    safePage * TAGS_PAGE_SIZE,
    filteredUnselectedTags.length
  );

  const handleClose = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    onClose();
  };

  const startRename = (t: TagRow) => {
    setActionError("");
    setRenameId(t.id);
    setRenameText(t.name);
  };

  const cancelRename = () => {
    setRenameId(null);
    setRenameText("");
  };

  const submitRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (renameId == null) return;
    const trimmed = renameText.trim();
    if (!trimmed) {
      setActionError("Tag name is required.");
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      await adminRenameTag(renameId, trimmed);
      cancelRename();
      await afterTagMutation();
    } catch (err) {
      setActionError(errMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (t: TagRow) => {
    const ok = window.confirm(
      `Delete tag "${t.name}"? It will be removed from every place that uses it.`
    );
    if (!ok) return;
    setBusy(true);
    setActionError("");
    try {
      await adminDeleteTag(t.id);
      setSelected((prev) => {
        const next = { ...prev };
        delete next[t.id];
        return next;
      });
      await afterTagMutation();
    } catch (err) {
      setActionError(errMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const openMerge = () => {
    if (selectedIds.length < 2) return;
    setActionError("");
    setMergeKeepId(selectedIds[0]);
    setMergeOpen(true);
  };

  const submitMerge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mergeKeepId == null || selectedIds.length < 2) return;
    const mergeInto = selectedIds.filter((id) => id !== mergeKeepId);
    if (mergeInto.length === 0) {
      setActionError("Pick at least two different tags to merge.");
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      await adminMergeTags(mergeKeepId, mergeInto);
      setSelected({});
      setMergeOpen(false);
      setMergeKeepId(null);
      await afterTagMutation();
    } catch (err) {
      setActionError(errMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!showModal) return null;

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
        aria-labelledby="manageTagsModalTitle"
        onClick={(e) => {
          if ((e.target as HTMLElement).classList.contains("modal")) {
            handleClose(e);
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
              <h5 className="modal-title" id="manageTagsModalTitle">
                <i className="fas fa-tags me-2" aria-hidden />
                Manage tags
              </h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={(e) => handleClose(e)}
                aria-label="Close"
              />
            </div>
            <div className="modal-body">
              {loadError ? (
                <div className="alert alert-danger mb-3" role="alert">
                  {loadError}
                </div>
              ) : null}
              {actionError ? (
                <div className="alert alert-danger mb-3" role="alert">
                  {actionError}
                </div>
              ) : null}

              <label htmlFor="manage-tags-search" className="form-label visually-hidden">
                Search tags
              </label>
              <input
                id="manage-tags-search"
                type="search"
                className="form-control mb-3"
                placeholder="Search tags…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={loading || Boolean(loadError)}
                autoComplete="off"
                spellCheck={false}
              />

              {renameId != null ? (
                <form className="mb-4 p-3 rounded border border-secondary" onSubmit={submitRename}>
                  <h6 className="small text-uppercase text-muted mb-2">Rename tag</h6>
                  <label htmlFor="manageTagsRenameInput" className="form-label">
                    New name
                  </label>
                  <div className="d-flex flex-wrap gap-2 align-items-start">
                    <input
                      id="manageTagsRenameInput"
                      className="form-control"
                      style={{ maxWidth: "20rem" }}
                      value={renameText}
                      onChange={(e) => setRenameText(e.target.value)}
                      disabled={busy}
                      maxLength={64}
                      autoComplete="off"
                    />
                    <button
                      type="submit"
                      className="btn btn-modern btn-primary-modern"
                      disabled={busy || loading}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn btn-modern btn-secondary-modern"
                      onClick={cancelRename}
                      disabled={busy}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}

              {mergeOpen && selectedIds.length >= 2 ? (
                <form className="mb-4 p-3 rounded border border-secondary" onSubmit={submitMerge}>
                  <h6 className="small text-uppercase text-muted mb-2">Merge tags</h6>
                  <p className="small text-muted mb-2">
                    Places tagged with the other selected tags will get the tag you keep. The other
                    tags are removed.
                  </p>
                  <fieldset>
                    <legend className="form-label mb-2">Keep this tag</legend>
                    <div className="d-flex flex-column gap-2">
                      {selectedIds.map((id) => {
                        const row = tags.find((t) => t.id === id);
                        const label = row?.name ?? `#${id}`;
                        return (
                          <label key={id} className="d-flex align-items-center gap-2 mb-0">
                            <input
                              type="radio"
                              name="mergeKeep"
                              checked={mergeKeepId === id}
                              onChange={() => setMergeKeepId(id)}
                              disabled={busy}
                            />
                            <span>{label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                  <div className="mt-3 d-flex flex-wrap gap-2">
                    <button
                      type="submit"
                      className="btn btn-modern btn-primary-modern"
                      disabled={busy || loading || mergeKeepId == null}
                    >
                      {busy ? (
                        <>
                          <span
                            className="spinner-border spinner-border-sm me-2"
                            role="status"
                            aria-hidden
                          />
                          Merging…
                        </>
                      ) : (
                        "Merge"
                      )}
                    </button>
                    <button
                      type="button"
                      className="btn btn-modern btn-secondary-modern"
                      onClick={() => {
                        setMergeOpen(false);
                        setMergeKeepId(null);
                      }}
                      disabled={busy}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}

              {loading ? (
                <p className="text-muted mb-0">Loading tags…</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm table-hover align-middle mb-0">
                    <thead>
                      <tr>
                        <th scope="col" style={{ width: "2.5rem" }}>
                          <span className="visually-hidden">Select</span>
                        </th>
                        <th scope="col">Tag</th>
                        <th scope="col" className="text-end">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tags.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-muted">
                            No tags yet.
                          </td>
                        </tr>
                      ) : (
                        <>
                          {pinnedTags.map((t) => (
                            <tr key={`pinned-${t.id}`} className="table-light">
                              <td>
                                <input
                                  type="checkbox"
                                  checked={Boolean(selected[t.id])}
                                  onChange={(e) =>
                                    setSelected((prev) => ({
                                      ...prev,
                                      [t.id]: e.target.checked,
                                    }))
                                  }
                                  disabled={busy}
                                  aria-label={`Select tag ${t.name}`}
                                />
                              </td>
                              <td>{t.name}</td>
                              <td className="text-end text-nowrap">
                                <button
                                  type="button"
                                  className="btn btn-link btn-sm py-0 me-2"
                                  onClick={() => startRename(t)}
                                  disabled={busy}
                                >
                                  Rename
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-link btn-sm py-0 text-danger"
                                  onClick={() => handleDelete(t)}
                                  disabled={busy}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                          {pinnedTags.length > 0 &&
                          searchQuery.trim() &&
                          hasUnselectedTags &&
                          filteredUnselectedTags.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="text-muted small">
                                No other tags match this search.
                              </td>
                            </tr>
                          ) : null}
                          {pinnedTags.length === 0 &&
                          filteredUnselectedTags.length === 0 &&
                          searchQuery.trim() ? (
                            <tr>
                              <td colSpan={3} className="text-muted">
                                No tags match your search.
                              </td>
                            </tr>
                          ) : null}
                          {pageUnselectedTags.map((t) => (
                            <tr key={t.id}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={Boolean(selected[t.id])}
                                  onChange={(e) =>
                                    setSelected((prev) => ({
                                      ...prev,
                                      [t.id]: e.target.checked,
                                    }))
                                  }
                                  disabled={busy}
                                  aria-label={`Select tag ${t.name}`}
                                />
                              </td>
                              <td>{t.name}</td>
                              <td className="text-end text-nowrap">
                                <button
                                  type="button"
                                  className="btn btn-link btn-sm py-0 me-2"
                                  onClick={() => startRename(t)}
                                  disabled={busy}
                                >
                                  Rename
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-link btn-sm py-0 text-danger"
                                  onClick={() => handleDelete(t)}
                                  disabled={busy}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {!loading && !loadError && tags.length > 0 && filteredUnselectedTags.length > 0 ? (
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
                  <span className="text-muted small">
                    Showing {rangeStart}–{rangeEnd} of {filteredUnselectedTags.length} (other tags)
                  </span>
                  <div className="btn-group btn-group-sm" role="group" aria-label="Tag pages">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={safePage <= 1 || busy}
                    >
                      Previous
                    </button>
                    <button type="button" className="btn btn-outline-secondary" disabled>
                      {safePage} / {totalPages}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safePage >= totalPages || busy}
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="modal-footer d-flex flex-wrap gap-2 justify-content-end align-items-center">
              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={openMerge}
                disabled={
                  loading || Boolean(loadError) || busy || selectedIds.length < 2 || mergeOpen
                }
              >
                <i className="fas fa-compress-arrows-alt me-1" aria-hidden />
                Merge selected
              </button>
              <button
                type="button"
                className="btn btn-modern btn-secondary-modern"
                onClick={(e) => handleClose(e)}
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
