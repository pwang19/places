import React, { useContext, useState, useEffect } from "react";
import PlaceFinder from "../apis/PlaceFinder";
import { PlacesContext } from "../context/PlacesContext";
import LocationAutocomplete from "./LocationAutocomplete";

const AddPlace = ({ showModal, onClose }) => {
  const { addPlaces } = useContext(PlacesContext);

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [priceRange, setPriceRange] = useState("Price Range");

  // Reset form when modal closes
  useEffect(() => {
    if (!showModal) {
      setName("");
      setLocation("");
      setPriceRange("Price Range");
    }
  }, [showModal]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showModal]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !location || priceRange === "Price Range") {
      return; // Don't submit if fields are empty
    }
    
    try {
      const response = await PlaceFinder.post("/", {
        name: name,
        location: location,
        price_range: priceRange,
      });
      addPlaces(response.data.data.place);
      console.log(response);
      // Close modal and reset form on success
      onClose();
      setName("");
      setLocation("");
      setPriceRange("Price Range");
    } catch (err) {
      console.error("Error adding place:", err);
    }
  };

  const handleClose = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    onClose();
  };

  if (!showModal) return null;

  return (
    <>
      <div
        className="modal-backdrop show"
        onClick={handleClose}
        style={{ opacity: 0.5, zIndex: 1040 }}
      ></div>
      <div
        className="modal show modern-modal"
        style={{ display: "block", zIndex: 1050 }}
        tabIndex="-1"
        role="dialog"
        onClick={(e) => {
          if (e.target.classList.contains('modal')) {
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
              <h5 className="modal-title">
                <i className="fas fa-plus-circle me-2"></i>
                Add New Place
              </h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={handleClose}
                aria-label="Close"
              ></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="mb-3">
                  <label htmlFor="placeName" className="form-label">
                    Place Name
                  </label>
                  <input
                    id="placeName"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    type="text"
                    className="form-control"
                    placeholder="Enter place name"
                    required
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="placeLocation" className="form-label">
                    Location
                  </label>
                  <LocationAutocomplete
                    id="placeLocation"
                    value={location}
                    onChange={setLocation}
                    placeholder="Enter location"
                    required
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="priceRange" className="form-label">
                    Price Range
                  </label>
                  <select
                    id="priceRange"
                    value={priceRange}
                    onChange={(e) => setPriceRange(e.target.value)}
                    className="form-select"
                    required
                  >
                    <option value="Price Range" disabled>Select Price Range</option>
                    <option value="1">$</option>
                    <option value="2">$$</option>
                    <option value="3">$$$</option>
                    <option value="4">$$$$</option>
                    <option value="5">$$$$$</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-modern btn-secondary-modern"
                  onClick={handleClose}
                >
                  <i className="fas fa-times me-2"></i>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-modern btn-primary-modern"
                >
                  <i className="fas fa-plus me-2"></i>
                  Add Place
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default AddPlace;
