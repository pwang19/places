/**
 * Base URL for the Express API (no trailing slash).
 * Override with REACT_APP_API_URL in .env (e.g. http://localhost:5001/api/v1).
 */
export const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:5001/api/v1";
