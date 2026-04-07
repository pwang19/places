import React, { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../context/AuthContext";

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";
const HOSTED_DOMAIN =
  process.env.REACT_APP_ALLOWED_EMAIL_DOMAIN || "acts2.network";

export default function LoginScreen() {
  const { loginWithCredential, meError } = useAuth();
  const [loginError, setLoginError] = useState(null);

  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || "";
  const supabaseAnon = process.env.REACT_APP_SUPABASE_ANON_KEY || "";

  if (!GOOGLE_CLIENT_ID || !supabaseUrl || !supabaseAnon) {
    return (
      <div className="auth-gate">
        <div className="auth-card">
          <h1 className="auth-title">Places</h1>
          <p className="auth-message auth-message--error">
            Missing environment variables. Add to <code>client/.env</code> and
            restart the dev server:
            <br />
            <code>REACT_APP_GOOGLE_CLIENT_ID</code>,{" "}
            <code>REACT_APP_SUPABASE_URL</code>,{" "}
            <code>REACT_APP_SUPABASE_ANON_KEY</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-gate">
      <div className="auth-card">
        <h1 className="auth-title">Places</h1>
        <p className="auth-subtitle">
          Sign in with your <strong>@{HOSTED_DOMAIN}</strong> Google account.
        </p>
        {(meError || loginError) && (
          <p className="auth-message auth-message--error" role="alert">
            {loginError || meError}
          </p>
        )}
        <div className="auth-google-wrap">
          <GoogleLogin
            hosted_domain={HOSTED_DOMAIN}
            onSuccess={async (res) => {
              setLoginError(null);
              try {
                await loginWithCredential(res.credential);
              } catch (e) {
                setLoginError(e.message || "Sign-in failed");
              }
            }}
            onError={() => setLoginError("Google sign-in was cancelled or failed")}
            text="signin_with"
            shape="rectangular"
            size="large"
            theme="outline"
          />
        </div>
      </div>
    </div>
  );
}
