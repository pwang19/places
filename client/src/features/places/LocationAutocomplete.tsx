import React, { useState, useEffect } from "react";

const LocationAutocomplete = ({ value, onChange, id, placeholder, required }) => {
  const [inputValue, setInputValue] = useState(value || "");

  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
  };

  return (
    <input
      id={id}
      type="text"
      className="form-control"
      value={inputValue}
      onChange={handleInputChange}
      placeholder={placeholder}
      required={required}
      autoComplete="street-address"
    />
  );
};

export default LocationAutocomplete;
