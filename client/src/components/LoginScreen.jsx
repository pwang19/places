import React, { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../context/AuthContext";

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";
const HOSTED_DOMAIN =
  process.env.REACT_APP_ALLOWED_EMAIL_DOMAIN || "acts2.network";

export default function LoginScreen() {
  const { loginWithCredential, meError } = useAuth();
  const [loginError, setLoginError] = useState(null);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <div className="auth-gate">
        <div className="auth-card">
          <h1 className="auth-title">Places</h1>
          <p className="auth-message auth-message--error">
            Missing <code>REACT_APP_GOOGLE_CLIENT_ID</code>. Add it to{" "}
            <code>client/.env</code> and restart the dev server.
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
