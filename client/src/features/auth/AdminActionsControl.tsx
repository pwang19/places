import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { parseAllowedEmailDomains } from "../../utils/allowedEmailDomains";
import EditAdminsModal from "./EditAdminsModal";
import ManageTagsModal from "./ManageTagsModal";

export default function AdminActionsControl() {
  const { isAdmin, refreshIsAdmin } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAdminsModal, setShowAdminsModal] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  if (!isAdmin) return null;

  return (
    <>
      <div className="position-relative" ref={rootRef}>
        <button
          type="button"
          name="Admin Actions"
          className="btn btn-sm btn-outline-primary dropdown-toggle"
          aria-expanded={menuOpen}
          aria-haspopup="true"
          aria-controls="admin-actions-menu"
          id="admin-actions-button"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <i className="fas fa-user-shield me-1" aria-hidden />
          Admin Actions
        </button>
        {menuOpen ? (
          <ul
            id="admin-actions-menu"
            className="dropdown-menu show admin-actions-dropdown"
            role="menu"
            aria-labelledby="admin-actions-button"
            style={{
              position: "absolute",
              right: 0,
              top: "100%",
              marginTop: "0.25rem",
              zIndex: 1060,
            }}
          >
            <li role="none">
              <button
                type="button"
                className="dropdown-item"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setShowAdminsModal(true);
                }}
              >
                <i className="fas fa-users-cog me-2 text-muted" aria-hidden />
                Edit Admins
              </button>
            </li>
            <li role="none">
              <button
                type="button"
                className="dropdown-item"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setShowTagsModal(true);
                }}
              >
                <i className="fas fa-tags me-2 text-muted" aria-hidden />
                Manage Tags
              </button>
            </li>
          </ul>
        ) : null}
      </div>
      <EditAdminsModal
        showModal={showAdminsModal}
        onClose={() => setShowAdminsModal(false)}
        onSaved={refreshIsAdmin}
        allowedDomainsList={parseAllowedEmailDomains(
          import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN
        ).join(", ")}
      />
      <ManageTagsModal showModal={showTagsModal} onClose={() => setShowTagsModal(false)} />
    </>
  );
}
