import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  listPlaceListsPicker,
  getPlaceListDetailRpc,
  createPlaceListRpc,
  addPlaceToListRpc,
  removePlaceFromListRpc,
  updatePlaceListMetaRpc,
  setPlaceListPublicRpc,
  deletePlaceListRpc,
} from "../apis/placesApi";
import { readPlaceDragData, setPlaceDragData } from "../utils/placeDrag";

const DRAFT_VALUE = "";

function PlaceListWorkbench() {
  const [pickerOptions, setPickerOptions] = useState([]);
  const [pickerValue, setPickerValue] = useState(DRAFT_VALUE);
  const [workspaceMode, setWorkspaceMode] = useState("draft");
  const [activeListId, setActiveListId] = useState(null);
  const [listMeta, setListMeta] = useState(null);
  const [placesInList, setPlacesInList] = useState([]);
  const [loadingPicker, setLoadingPicker] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [errorBanner, setErrorBanner] = useState("");

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  const [saveIsPublic, setSaveIsPublic] = useState(false);
  const [saveSubmitting, setSaveSubmitting] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [showListDetailsModal, setShowListDetailsModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");

  const refreshPicker = useCallback(async () => {
    setLoadingPicker(true);
    setErrorBanner("");
    try {
      const rows = await listPlaceListsPicker();
      setPickerOptions(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setErrorBanner(e?.message || "Could not load lists.");
      setPickerOptions([]);
    } finally {
      setLoadingPicker(false);
    }
  }, []);

  useEffect(() => {
    refreshPicker();
  }, [refreshPicker]);

  const applyDetailPayload = useCallback((payload, listId) => {
    const meta = payload?.list;
    const pls = Array.isArray(payload?.places) ? payload.places : [];
    setListMeta(meta || null);
    setPlacesInList(pls);
    setActiveListId(listId);
    setWorkspaceMode("existing");
  }, []);

  const loadListDetail = useCallback(
    async (listId) => {
      setLoadingDetail(true);
      setErrorBanner("");
      try {
        const payload = await getPlaceListDetailRpc(listId);
        applyDetailPayload(payload, listId);
      } catch (e) {
        setErrorBanner(e?.message || "Could not open list.");
      } finally {
        setLoadingDetail(false);
      }
    },
    [applyDetailPayload]
  );

  const goDraft = useCallback(() => {
    setPickerValue(DRAFT_VALUE);
    setWorkspaceMode("draft");
    setActiveListId(null);
    setListMeta(null);
    setPlacesInList([]);
  }, []);

  const handlePickerChange = useCallback(
    async (e) => {
      const v = e.target.value;
      if (
        workspaceMode === "draft" &&
        placesInList.length > 0 &&
        v !== DRAFT_VALUE
      ) {
        const ok = window.confirm(
          "Discard places in your new list? They are not saved until you create the list."
        );
        if (!ok) {
          e.preventDefault();
          return;
        }
      }
      setPickerValue(v);
      if (v === DRAFT_VALUE) {
        goDraft();
      } else {
        await loadListDetail(Number(v));
      }
    },
    [workspaceMode, placesInList.length, goDraft, loadListDetail]
  );

  const refreshCurrentList = useCallback(async () => {
    if (activeListId != null) {
      await loadListDetail(activeListId);
    }
  }, [activeListId, loadListDetail]);

  const handleDropOnList = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const data = readPlaceDragData(e.dataTransfer);
      if (!data || data.source === "listPanel") return;

      const pid = Number(data.id);
      if (!Number.isFinite(pid)) return;

      if (workspaceMode === "draft") {
        setPlacesInList((prev) => {
          if (prev.some((p) => String(p.id) === String(pid))) return prev;
          return [
            ...prev,
            {
              id: pid,
              name: data.name || `Place ${pid}`,
              location: data.location || "",
              price_range: data.price_range ?? null,
            },
          ];
        });
        return;
      }

      setErrorBanner("");
      try {
        await addPlaceToListRpc(activeListId, pid);
        await refreshCurrentList();
      } catch (err) {
        setErrorBanner(err?.message || "Could not add place.");
      }
    },
    [workspaceMode, activeListId, refreshCurrentList]
  );

  const handleDragOverList = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const openSaveModal = useCallback(() => {
    setSaveName("");
    setSaveDescription("");
    setSaveIsPublic(false);
    setSaveError("");
    setShowSaveModal(true);
  }, []);

  const submitSaveNewList = useCallback(
    async (ev) => {
      ev.preventDefault();
      setSaveError("");
      const name = saveName.trim();
      if (!name) {
        setSaveError("Name is required.");
        return;
      }
      setSaveSubmitting(true);
      try {
        const ids = placesInList.map((p) => p.id);
        const newId = await createPlaceListRpc(
          name,
          saveDescription,
          saveIsPublic,
          ids
        );
        setShowSaveModal(false);
        await refreshPicker();
        setPickerValue(String(newId));
        await loadListDetail(newId);
      } catch (err) {
        setSaveError(err?.message || "Save failed.");
      } finally {
        setSaveSubmitting(false);
      }
    },
    [
      saveName,
      saveDescription,
      saveIsPublic,
      placesInList,
      refreshPicker,
      loadListDetail,
    ]
  );

  const openListDetailsModal = useCallback(() => {
    if (!listMeta) return;
    setEditName(listMeta.name || "");
    setEditDescription(listMeta.description || "");
    setEditError("");
    setShowListDetailsModal(true);
  }, [listMeta]);

  const submitEditMeta = useCallback(
    async (ev) => {
      ev.preventDefault();
      if (activeListId == null) return;
      setEditError("");
      const name = editName.trim();
      if (!name) {
        setEditError("Name is required.");
        return;
      }
      setEditSubmitting(true);
      try {
        await updatePlaceListMetaRpc(activeListId, name, editDescription);
        await refreshPicker();
        await refreshCurrentList();
        setShowListDetailsModal(false);
      } catch (err) {
        setEditError(err?.message || "Update failed.");
      } finally {
        setEditSubmitting(false);
      }
    },
    [activeListId, editName, editDescription, refreshPicker, refreshCurrentList]
  );

  const handleMakePublicClick = useCallback(async () => {
    if (activeListId == null || !listMeta?.is_owner || listMeta.is_public) return;
    const ok = window.confirm(
      "This list will become public. Anyone signed in can view it and add places. You will not be able to make it private again. Continue?"
    );
    if (!ok) return;
    setErrorBanner("");
    try {
      await setPlaceListPublicRpc(activeListId);
      await refreshPicker();
      await refreshCurrentList();
      setShowListDetailsModal(false);
    } catch (e) {
      setErrorBanner(e?.message || "Could not publish list.");
    }
  }, [activeListId, listMeta, refreshPicker, refreshCurrentList]);

  const handleDeleteList = useCallback(async () => {
    if (activeListId == null || !listMeta?.is_owner) return;
    if (
      !window.confirm(
        "Delete this list permanently? Places stay on the map; only the list is removed."
      )
    ) {
      return;
    }
    setErrorBanner("");
    try {
      await deletePlaceListRpc(activeListId);
      setShowListDetailsModal(false);
      goDraft();
      await refreshPicker();
    } catch (e) {
      setErrorBanner(e?.message || "Could not delete list.");
    }
  }, [activeListId, listMeta, goDraft, refreshPicker]);

  const isOwner = Boolean(listMeta?.is_owner);
  const canRemoveFromList = workspaceMode === "draft" || isOwner;
  const isDraft = workspaceMode === "draft";

  useEffect(() => {
    if (!showSaveModal) {
      document.body.style.overflow = "unset";
      return undefined;
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showSaveModal]);

  useEffect(() => {
    if (!showListDetailsModal) {
      return undefined;
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showListDetailsModal]);

  return (
    <aside className="place-list-workbench" aria-label="Place lists">
      <h2 className="place-list-workbench-title h6 mb-2">Lists</h2>
      <label className="form-label small text-muted mb-1" htmlFor="place-list-picker">
        Open or start a list
      </label>
      <select
        id="place-list-picker"
        className="form-select form-select-sm mb-2"
        value={pickerValue}
        onChange={handlePickerChange}
        disabled={loadingPicker || loadingDetail}
      >
        <option value={DRAFT_VALUE}>New list (unsaved)</option>
        {pickerOptions.map((row) => (
          <option key={row.id} value={String(row.id)}>
            {row.name}
            {row.is_public ? " · public" : " · private"}
            {!row.is_owner ? " · shared" : ""}
          </option>
        ))}
      </select>

      {!isDraft && isOwner ? (
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary w-100 mb-2"
          onClick={openListDetailsModal}
        >
          Edit List Details
        </button>
      ) : null}

      {errorBanner ? (
        <p className="text-danger small mb-2" role="alert">
          {errorBanner}
        </p>
      ) : null}

      <div className="place-list-workbench-actions d-flex flex-wrap gap-1 mb-2">
        {isDraft ? (
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={placesInList.length === 0}
            onClick={openSaveModal}
          >
            Save list…
          </button>
        ) : null}
      </div>

      <div
        className="place-list-workbench-dropzone"
        onDragOver={handleDragOverList}
        onDrop={handleDropOnList}
      >
        <p className="place-list-workbench-dropzone-hint small text-muted mb-2">
          Drag places here using the grip on each card. Drag out to remove
          {canRemoveFromList ? "" : " (only the list owner can remove)"}.
        </p>
        {loadingDetail ? (
          <p className="small text-muted mb-0">Loading…</p>
        ) : placesInList.length === 0 ? (
          <p className="small text-muted mb-0">No places in this list yet.</p>
        ) : (
          <ul className="place-list-workbench-items list-unstyled mb-0">
            {placesInList.map((p) => (
              <li key={p.id} className="place-list-workbench-item">
                {canRemoveFromList ? (
                  <span
                    className="place-list-workbench-item-inner"
                    draggable
                    onDragStart={(e) => {
                      setPlaceDragData(e.dataTransfer, {
                        source: "listPanel",
                        listId: activeListId ?? undefined,
                        id: p.id,
                        name: p.name,
                        location: p.location,
                        price_range: p.price_range ?? null,
                      });
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={(e) => {
                      if (e.dataTransfer.dropEffect !== "none") return;
                      if (
                        !window.confirm(
                          `Remove “${p.name || "this place"}” from this list?`
                        )
                      ) {
                        return;
                      }
                      if (isDraft) {
                        setPlacesInList((prev) =>
                          prev.filter((x) => String(x.id) !== String(p.id))
                        );
                      } else if (activeListId != null) {
                        removePlaceFromListRpc(activeListId, p.id)
                          .then(() => refreshCurrentList())
                          .catch((err) =>
                            setErrorBanner(err?.message || "Remove failed.")
                          );
                      }
                    }}
                  >
                    <i className="fas fa-grip-vertical me-2 text-muted" aria-hidden />
                    <span className="place-list-workbench-item-name">{p.name}</span>
                  </span>
                ) : (
                  <span className="place-list-workbench-item-inner place-list-workbench-item-inner--readonly">
                    <span className="place-list-workbench-item-name">{p.name}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {showSaveModal
        ? createPortal(
            <div
              className="modal show d-block place-list-modal"
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="save-list-modal-title"
            >
              <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title" id="save-list-modal-title">
                      Save new list
                    </h5>
                    <button
                      type="button"
                      className="btn-close"
                      aria-label="Close"
                      onClick={() => setShowSaveModal(false)}
                    />
                  </div>
                  <form onSubmit={submitSaveNewList}>
                    <div className="modal-body">
                      {saveError ? (
                        <p className="text-danger small" role="alert">
                          {saveError}
                        </p>
                      ) : null}
                      <div className="mb-2">
                        <label className="form-label" htmlFor="save-list-name">
                          Name
                        </label>
                        <input
                          id="save-list-name"
                          className="form-control"
                          value={saveName}
                          onChange={(ev) => setSaveName(ev.target.value)}
                          required
                          autoFocus
                        />
                      </div>
                      <div className="mb-2">
                        <label className="form-label" htmlFor="save-list-desc">
                          Description (optional)
                        </label>
                        <textarea
                          id="save-list-desc"
                          className="form-control"
                          rows={2}
                          value={saveDescription}
                          onChange={(ev) => setSaveDescription(ev.target.value)}
                        />
                      </div>
                      <div className="form-check">
                        <input
                          id="save-list-public"
                          type="checkbox"
                          className="form-check-input"
                          checked={saveIsPublic}
                          onChange={(ev) => setSaveIsPublic(ev.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="save-list-public">
                          Public (others can view and add places; only you can rename,
                          remove places, or delete)
                        </label>
                      </div>
                    </div>
                    <div className="modal-footer">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setShowSaveModal(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={saveSubmitting}
                      >
                        {saveSubmitting ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
              <div
                className="modal-backdrop show"
                aria-hidden
                onClick={() => setShowSaveModal(false)}
              />
            </div>,
            document.body
          )
        : null}

      {showListDetailsModal
        ? createPortal(
            <div
              className="modal show d-block place-list-modal"
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="list-details-modal-title"
            >
              <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title" id="list-details-modal-title">
                      Edit list details
                    </h5>
                    <button
                      type="button"
                      className="btn-close"
                      aria-label="Close"
                      onClick={() => setShowListDetailsModal(false)}
                    />
                  </div>
                  <div className="modal-body">
                    {editError ? (
                      <p className="text-danger small" role="alert">
                        {editError}
                      </p>
                    ) : null}
                    <form onSubmit={submitEditMeta}>
                      <div className="mb-2">
                        <label className="form-label" htmlFor="edit-list-name">
                          Name
                        </label>
                        <input
                          id="edit-list-name"
                          className="form-control"
                          value={editName}
                          onChange={(ev) => setEditName(ev.target.value)}
                          required
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label" htmlFor="edit-list-desc">
                          Description (optional)
                        </label>
                        <textarea
                          id="edit-list-desc"
                          className="form-control"
                          rows={2}
                          value={editDescription}
                          onChange={(ev) => setEditDescription(ev.target.value)}
                        />
                      </div>
                      <div className="d-flex flex-wrap gap-2 align-items-center">
                        {!listMeta?.is_public ? (
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm"
                            onClick={handleMakePublicClick}
                          >
                            Make public
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          onClick={handleDeleteList}
                        >
                          Delete list
                        </button>
                        <button
                          type="submit"
                          className="btn btn-primary btn-sm"
                          disabled={editSubmitting}
                        >
                          {editSubmitting ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
              <div
                className="modal-backdrop show"
                aria-hidden
                onClick={() => setShowListDetailsModal(false)}
              />
            </div>,
            document.body
          )
        : null}
    </aside>
  );
}

export default PlaceListWorkbench;
