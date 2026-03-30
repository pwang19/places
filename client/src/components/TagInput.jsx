import React, { useCallback, useEffect, useRef, useState } from "react";
import TagFinder from "../apis/TagFinder";

const DEBOUNCE_MS = 250;

/**
 * Tag text field with API suggestions. Only commits on Enter (optional Arrow keys to highlight).
 * Clicking a suggestion fills the input; user still presses Enter to submit.
 */
const TagInput = ({
  id,
  placeholder = "Type a tag and press Enter",
  onSubmitName,
  disabled = false,
  className = "",
  showHint = true,
}) => {
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);
  const ignoreBlurRef = useRef(false);

  const fetchSuggestions = useCallback(async (q) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    try {
      const res = await TagFinder.get("/", { params: { q: trimmed } });
      const tags = res.data?.data?.tags || [];
      setSuggestions(tags);
      setOpen(tags.length > 0);
      setActiveIndex(-1);
    } catch (e) {
      console.error(e);
      setSuggestions([]);
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, fetchSuggestions]);

  const commit = async () => {
    const fromList =
      activeIndex >= 0 && activeIndex < suggestions.length
        ? suggestions[activeIndex].name
        : null;
    const raw = (fromList || value).trim();
    if (!raw || disabled) return;
    try {
      await onSubmitName(raw);
      setValue("");
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
    } catch (e) {
      console.error(e);
    }
  };

  const onKeyDown = (e) => {
    if (!open || suggestions.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const onSuggestionMouseDown = (e) => {
    e.preventDefault();
    ignoreBlurRef.current = true;
  };

  const onSuggestionClick = (name) => {
    setValue(name);
    setOpen(suggestions.length > 0);
    setActiveIndex(-1);
    ignoreBlurRef.current = false;
  };

  return (
    <div className={`position-relative ${className}`}>
      <input
        id={id}
        type="text"
        className="form-control"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        onBlur={() => {
          if (ignoreBlurRef.current) {
            ignoreBlurRef.current = false;
            return;
          }
          setTimeout(() => setOpen(false), 150);
        }}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={id ? `${id}-tag-suggestions` : undefined}
      />
      {open && suggestions.length > 0 && (
        <ul
          id={id ? `${id}-tag-suggestions` : undefined}
          className="list-group position-absolute w-100 shadow-sm mt-1"
          style={{ zIndex: 1060, maxHeight: "220px", overflowY: "auto" }}
          role="listbox"
        >
          {suggestions.map((t, idx) => (
            <li
              key={t.id}
              role="option"
              aria-selected={idx === activeIndex}
              className={`list-group-item list-group-item-action py-2 ${
                idx === activeIndex ? "active" : ""
              }`}
              onMouseDown={onSuggestionMouseDown}
              onClick={() => onSuggestionClick(t.name)}
            >
              {t.name}
            </li>
          ))}
        </ul>
      )}
      {showHint ? (
        <div className="form-text text-muted small mt-1">
          Suggestions match as you type. Press Enter to apply (new or existing tag).
        </div>
      ) : null}
    </div>
  );
};

export default TagInput;
