import React, { useState, useEffect, useRef } from "react";

const LocationAutocomplete = ({ value, onChange, id, placeholder, required }) => {
  const [inputValue, setInputValue] = useState(value || "");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const debounceTimerRef = useRef(null);

  const MAPBOX_ACCESS_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const fetchSuggestions = async (query) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (!MAPBOX_ACCESS_TOKEN) {
      console.warn("Mapbox access token not configured");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=5&types=address,poi`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch suggestions");
      }

      const data = await response.json();
      setSuggestions(data.features || []);
      setShowSuggestions(data.features && data.features.length > 0);
      setSelectedIndex(-1);
    } catch (error) {
      console.error("Error fetching address suggestions:", error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce API calls
    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 400);
  };

  const handleSelectSuggestion = (suggestion) => {
    const address = suggestion.place_name || suggestion.text;
    setInputValue(address);
    onChange(address);
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
      default:
        break;
    }
  };

  const handleBlur = (e) => {
    // Delay hiding suggestions to allow click events to fire
    setTimeout(() => {
      if (!suggestionsRef.current?.contains(document.activeElement)) {
        setShowSuggestions(false);
      }
    }, 200);
  };

  const handleFocus = () => {
    if (inputValue && suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  return (
    <div className="position-relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        className="form-control"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
      />
      {isLoading && (
        <div
          className="position-absolute"
          style={{
            right: "10px",
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-secondary)",
          }}
        >
          <i className="fas fa-spinner fa-spin"></i>
        </div>
      )}
      {showSuggestions && suggestions.length > 0 && (
        <ul
          ref={suggestionsRef}
          className="list-group position-absolute w-100"
          style={{
            zIndex: 1060,
            maxHeight: "300px",
            overflowY: "auto",
            marginTop: "2px",
            boxShadow: "var(--shadow-lg)",
            borderRadius: "10px",
            border: "2px solid var(--border-color)",
          }}
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.id}
              className={`list-group-item ${
                index === selectedIndex ? "active" : ""
              }`}
              style={{
                backgroundColor:
                  index === selectedIndex
                    ? "var(--color-teal)"
                    : "rgba(255, 255, 250, 0.1)",
                color: "var(--text-primary)",
                border: "none",
                borderBottom:
                  index < suggestions.length - 1
                    ? "1px solid var(--border-color)"
                    : "none",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              onMouseLeave={() => setSelectedIndex(-1)}
              onClick={() => handleSelectSuggestion(suggestion)}
            >
              <div style={{ fontWeight: 600, marginBottom: "2px" }}>
                {suggestion.text}
              </div>
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "var(--text-secondary)",
                  opacity: 0.8,
                }}
              >
                {suggestion.place_name}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LocationAutocomplete;

