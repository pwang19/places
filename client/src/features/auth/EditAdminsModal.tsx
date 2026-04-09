import React, { useEffect, useState } from "react";
import { getAppAdmins, replaceAppAdmins } from "../../api/placesApi";

type EditAdminsModalProps = {
  showModal: boolean;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  emailDomain: string;
};

export default function EditAdminsModal({
  showModal,
  onClose,
  onSaved,
  emailDomain,
}: EditAdminsModalProps) {
  const [text, setText] = useState("");
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!showModal) return undefined;
    let cancelled = false;
    setLoadError("");
    setSubmitError("");
    setLoading(true);
    getAppAdmins()
      .then((names) => {
        if (!cancelled) setText(names.join("\n"));
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(
            err.response?.data?.message || err.message || "Could not load admins"
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showModal]);

  useEffect(() => {
    if (!showModal) return undefined;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showModal]);

  const handleClose = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    onClose();
  };

  const parseUsernames = (raw: string) => {
    const lines = raw.split(/\r?\n/);
    const out: string[] = [];
    const seen = new Set<string>();
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
    return out;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    const usernames = parseUsernames(text);
    if (usernames.length === 0) {
      setSubmitError("Add at least one admin username.");
      return;
    }
    setSubmitting(true);
    try {
      await replaceAppAdmins(usernames);
      await onSaved();
      handleClose();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ||
        (err as Error)?.message ||
        "Could not update admins.";
      setSubmitError(String(msg));
    } finally {
      setSubmitting(false);
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
        aria-labelledby="editAdminsModalTitle"
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
              <h5 className="modal-title" id="editAdminsModalTitle">
                <i className="fas fa-user-shield me-2" aria-hidden />
                Edit admins
              </h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={(e) => handleClose(e)}
                aria-label="Close"
              />
            </div>
            <form onSubmit={handleSubmit} noValidate>
              <div className="modal-body">
                {loadError ? (
                  <div className="alert alert-danger mb-3" role="alert">
                    {loadError}
                  </div>
                ) : null}
                {submitError ? (
                  <div className="alert alert-danger mb-3" role="alert">
                    {submitError}
                  </div>
                ) : null}
                <p className="text-muted small mb-2">
                  One username per line (the part before @{emailDomain}). The list
                  must include at least one admin.
                </p>
                <label htmlFor="editAdminsTextarea" className="form-label visually-hidden">
                  Admin usernames
                </label>
                <textarea
                  id="editAdminsTextarea"
                  className="form-control font-monospace"
                  rows={8}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={loading || Boolean(loadError)}
                  placeholder="peter.wang"
                  spellCheck={false}
                />
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-modern btn-secondary-modern"
                  onClick={(e) => handleClose(e)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-modern btn-primary-modern"
                  disabled={loading || Boolean(loadError) || submitting}
                >
                  {submitting ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden
                      />
                      Saving…
                    </>
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
