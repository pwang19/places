import React from 'react'

const Header = ({ onAddClick }) => {
  return (
    <div className="modern-header d-flex justify-content-between align-items-center">
      <h1 className="text-center flex-grow-1 mb-0">
        <i className="fas fa-map-marker-alt me-3"></i>
        Places
      </h1>
      <button
        className="btn btn-primary-modern btn-lg"
        onClick={onAddClick}
        style={{ minWidth: '180px' }}
      >
        <i className="fas fa-plus me-2"></i>
        Add Place
      </button>
    </div>
  )
}

export default Header