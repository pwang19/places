import React from "react";
import UserMenu from "../auth/UserMenu";

const Header = ({ onAddClick }) => {
  return (
    <div className="modern-header d-flex justify-content-between align-items-center flex-wrap gap-3">
      <h1 className="modern-header-title mb-0">
        <i className="fas fa-map-marker-alt me-3"></i>
        Places
      </h1>
      <div className="modern-header-actions d-flex align-items-center flex-wrap gap-2">
        <UserMenu />
        <button
          className="btn btn-primary-modern btn-lg"
          onClick={onAddClick}
          style={{ minWidth: "180px" }}
          type="button"
        >
          <i className="fas fa-plus me-2"></i>
          Add Place
        </button>
      </div>
    </div>
  );
};

export default Header