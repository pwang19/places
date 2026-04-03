import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { API_BASE_URL } from "../config/api";

const AuthContext = createContext(null);

async function fetchMe(signal) {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    credentials: "include",
    signal,
  });
  if (res.status === 401) return null;
  if (!res.ok) {
    const err = new Error("Failed to verify session");
    err.status = res.status;
    throw err;
  }
  const body = await res.json();
  return body.data && body.data.user ? body.data.user : null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);
  const [meError, setMeError] = useState(null);

  const refresh = useCallback(async () => {
    setMeError(null);
    try {
      const u = await fetchMe();
      setUser(u);
    } catch (e) {
      setMeError(e.message || "Could not reach server");
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const u = await fetchMe(ac.signal);
        if (!ac.signal.aborted) setUser(u);
      } catch (e) {
        if (e.name === "AbortError") return;
        if (!ac.signal.aborted) {
          setMeError(e.message || "Could not reach server");
          setUser(null);
        }
      }
    })();
    return () => ac.abort();
  }, []);

  const loginWithCredential = useCallback(async (credential) => {
    setMeError(null);
    const res = await fetch(`${API_BASE_URL}/auth/google`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        (body && body.message) ||
        (res.status === 403
          ? "This account is not allowed to sign in"
          : "Sign-in failed");
      throw new Error(msg);
    }
    const u = body.data && body.data.user;
    if (u) setUser(u);
    else await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    setMeError(null);
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading: user === undefined,
      meError,
      refresh,
      loginWithCredential,
      logout,
    }),
    [user, meError, refresh, loginWithCredential, logout]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
