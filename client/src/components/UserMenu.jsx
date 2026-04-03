import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function UserMenu() {
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  return (
    <div className="user-menu d-flex align-items-center gap-2">
      <span className="user-menu-email text-truncate" title={user.email}>
        {user.email}
      </span>
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await logout();
          } finally {
            setBusy(false);
          }
        }}
      >
        Sign out
      </button>
    </div>
  );
}
