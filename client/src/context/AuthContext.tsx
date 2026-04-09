import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

function mapSupabaseUser(u) {
  if (!u) return null;
  return {
    sub: u.id,
    email: u.email,
    name: u.user_metadata?.full_name || u.user_metadata?.name,
  };
}

function allowedEmailDomain() {
  return (import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN || "acts2.network").toLowerCase();
}

function isAllowedDomain(email) {
  if (!email || typeof email !== "string") return false;
  const domain = allowedEmailDomain();
  return email.toLowerCase().endsWith(`@${domain}`);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);
  const [meError, setMeError] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      setUser(null);
      setMeError(
        "Missing Supabase env: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
      );
      return;
    }

    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (cancelled) return;
      if (error) {
        setMeError(error.message);
        setUser(null);
        return;
      }
      setUser(session ? mapSupabaseUser(session.user) : null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setUser(session ? mapSupabaseUser(session.user) : null);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    setMeError(null);
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      setUser(session ? mapSupabaseUser(session.user) : null);
    } catch (e) {
      setMeError(e.message || "Could not verify session");
      setUser(null);
    }
  }, []);

  const loginWithCredential = useCallback(async (credential) => {
    if (!supabase) {
      throw new Error("Supabase is not configured");
    }
    setMeError(null);
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: credential,
    });
    if (error) {
      throw new Error(error.message || "Sign-in failed");
    }
    const u = data.user || data.session?.user;
    const email = u?.email;
    if (!isAllowedDomain(email)) {
      await supabase.auth.signOut();
      throw new Error(`Only @${allowedEmailDomain()} accounts may sign in`);
    }
    setUser(mapSupabaseUser(u));
  }, []);

  const logout = useCallback(async () => {
    if (!supabase) return;
    setMeError(null);
    await supabase.auth.signOut();
    setUser(null);
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
