import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import EditAdminsModal from "./EditAdminsModal";

function allowedEmailDomain() {
  return (import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN || "acts2.network").toLowerCase();
}

export default function EditAdminsControl() {
  const { isAdmin, refreshIsAdmin } = useAuth();
  const [showModal, setShowModal] = useState(false);

  if (!isAdmin) return null;

  return (
    <>
      <button
        type="button"
        name="Edit Admins"
        className="btn btn-sm btn-outline-primary"
        onClick={() => setShowModal(true)}
      >
        <i className="fas fa-user-shield me-1" aria-hidden />
        Edit Admins
      </button>
      <EditAdminsModal
        showModal={showModal}
        onClose={() => setShowModal(false)}
        onSaved={refreshIsAdmin}
        emailDomain={allowedEmailDomain()}
      />
    </>
  );
}
