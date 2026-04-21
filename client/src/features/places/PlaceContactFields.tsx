import React from "react";

function ensureOneRow(rows) {
  return rows.length > 0 ? rows : [""];
}

/**
 * Phone + repeatable email / website inputs for add/edit place forms.
 */
export default function PlaceContactFields({
  phone,
  onPhoneChange,
  emails,
  onEmailsChange,
  websites,
  onWebsitesChange,
  idPrefix = "place",
}) {
  const emailRows = ensureOneRow(emails);
  const websiteRows = ensureOneRow(websites);

  const setEmailRow = (index, value) => {
    const next = [...emailRows];
    next[index] = value;
    onEmailsChange(next);
  };

  const setWebsiteRow = (index, value) => {
    const next = [...websiteRows];
    next[index] = value;
    onWebsitesChange(next);
  };

  const removeEmailRow = (index) => {
    const next = emailRows.filter((_, i) => i !== index);
    onEmailsChange(next.length ? next : [""]);
  };

  const removeWebsiteRow = (index) => {
    const next = websiteRows.filter((_, i) => i !== index);
    onWebsitesChange(next.length ? next : [""]);
  };

  return (
    <>
      <div className="mb-3">
        <label htmlFor={`${idPrefix}-phone`} className="form-label">
          Phone
        </label>
        <input
          id={`${idPrefix}-phone`}
          type="tel"
          className="form-control"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          placeholder="Phone number"
          autoComplete="tel"
        />
      </div>
      <div className="mb-3">
        <label className="form-label d-block">Email addresses</label>
        {emailRows.map((val, i) => (
          <div key={`e-${i}`} className="input-group mb-2">
            <input
              type="text"
              className="form-control"
              inputMode="email"
              autoComplete="email"
              value={val}
              onChange={(e) => setEmailRow(i, e.target.value)}
              placeholder="name@example.com"
              aria-label={`Email ${i + 1}`}
            />
            {emailRows.length > 1 ? (
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => removeEmailRow(i)}
                aria-label={`Remove email ${i + 1}`}
              >
                ×
              </button>
            ) : null}
          </div>
        ))}
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => onEmailsChange([...emailRows, ""])}
        >
          <i className="fas fa-plus me-1" aria-hidden />
          Add email
        </button>
      </div>
      <div className="mb-3">
        <label className="form-label d-block">Websites</label>
        {websiteRows.map((val, i) => (
          <div key={`w-${i}`} className="input-group mb-2">
            <input
              type="text"
              className="form-control"
              inputMode="url"
              autoComplete="url"
              value={val}
              onChange={(e) => setWebsiteRow(i, e.target.value)}
              placeholder="https://example.com"
              aria-label={`Website ${i + 1}`}
            />
            {websiteRows.length > 1 ? (
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => removeWebsiteRow(i)}
                aria-label={`Remove website ${i + 1}`}
              >
                ×
              </button>
            ) : null}
          </div>
        ))}
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => onWebsitesChange([...websiteRows, ""])}
        >
          <i className="fas fa-plus me-1" aria-hidden />
          Add website
        </button>
      </div>
    </>
  );
}
