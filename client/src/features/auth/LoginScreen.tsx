import React, { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../../context/AuthContext";
import {
  devQuickFillDomain,
  formatAllowedDomainsForMessage,
  googleHostedDomain,
  parseAllowedEmailDomains,
} from "../../utils/allowedEmailDomains";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const ALLOWED_DOMAINS = parseAllowedEmailDomains(
  import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN
);
const GOOGLE_HOSTED_DOMAIN = googleHostedDomain(ALLOWED_DOMAINS);
const DEV_QUICK_FILL_DOMAIN = devQuickFillDomain(ALLOWED_DOMAINS);
const ALLOWED_DOMAINS_LABEL = formatAllowedDomainsForMessage(ALLOWED_DOMAINS);

const DEV_EMAIL_AUTH =
  Boolean(import.meta.env.DEV) &&
  import.meta.env.VITE_DEV_EMAIL_AUTH === "true";

export default function LoginScreen() {
  const { loginWithCredential, loginWithEmailPassword, meError } = useAuth();
  const [loginError, setLoginError] = useState(null);
  const [devEmail, setDevEmail] = useState("");
  const [devPassword, setDevPassword] = useState("");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

  const googleOk = Boolean(GOOGLE_CLIENT_ID);
  const canShowDevEmail = DEV_EMAIL_AUTH;
  const missingCore = !supabaseUrl || !supabaseAnon;
  const missingGoogleWhenRequired = !googleOk && !canShowDevEmail;

  if (missingCore || missingGoogleWhenRequired) {
    return (
      <div className="auth-gate">
        <div className="auth-card">
          <h1 className="auth-title">Places</h1>
          <p className="auth-message auth-message--error">
            Missing environment variables. Add to <code>client/.env</code> and
            restart the dev server:
            <br />
            <code>VITE_SUPABASE_URL</code>, <code>VITE_SUPABASE_ANON_KEY</code>
            {!canShowDevEmail && (
              <>
                , <code>VITE_GOOGLE_CLIENT_ID</code>
              </>
            )}
            {canShowDevEmail && (
              <>
                <br />
                Optional: <code>VITE_GOOGLE_CLIENT_ID</code> for Google sign-in.
                <br />
                Dev email login: set <code>VITE_DEV_EMAIL_AUTH=true</code> and{" "}
                <code>VITE_ALLOWED_EMAIL_DOMAIN</code> to match dummy emails (
                e.g. <code>places.local</code>).
              </>
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-gate">
      <div className="auth-card">
        <h1 className="auth-title">Places</h1>
        {googleOk ? (
          <p className="auth-subtitle">
            Sign in with your <strong>@{GOOGLE_HOSTED_DOMAIN}</strong> Google
            account.
            {ALLOWED_DOMAINS.length > 1 ? (
              <>
                {" "}
                <span className="d-block small mt-1">
                  Allowed: {ALLOWED_DOMAINS_LABEL}
                </span>
              </>
            ) : null}
          </p>
        ) : (
          <p className="auth-subtitle">Sign in (local dev)</p>
        )}
        {(meError || loginError) && (
          <p className="auth-message auth-message--error" role="alert">
            {loginError || meError}
          </p>
        )}
        {canShowDevEmail && (
          <form
            className="auth-dev-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setLoginError(null);
              try {
                await loginWithEmailPassword(devEmail, devPassword);
              } catch (err) {
                setLoginError(err.message || "Sign-in failed");
              }
            }}
          >
            <label className="form-label small text-muted d-block mb-1">
              Email
            </label>
            <input
              className="form-control form-control-sm mb-2"
              type="email"
              autoComplete="username"
              value={devEmail}
              onChange={(e) => setDevEmail(e.target.value)}
            />
            <label className="form-label small text-muted d-block mb-1">
              Password
            </label>
            <input
              className="form-control form-control-sm mb-2"
              type="password"
              autoComplete="current-password"
              value={devPassword}
              onChange={(e) => setDevPassword(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-sm w-100 mb-2">
              Sign in with email
            </button>
            <div className="d-flex flex-wrap gap-1 justify-content-center">
              {["user1", "user2", "admin"].map((local) => (
                <button
                  key={local}
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() =>
                    setDevEmail(`${local}@${DEV_QUICK_FILL_DOMAIN}`)
                  }
                >
                  {local}
                </button>
              ))}
            </div>
            <p className="small text-muted mt-2 mb-0 text-center">
              Allowed: {ALLOWED_DOMAINS_LABEL} (see{" "}
              <code>VITE_ALLOWED_EMAIL_DOMAIN</code>). Quick-fill uses @
              {DEV_QUICK_FILL_DOMAIN}
              {ALLOWED_DOMAINS.length > 1
                ? " when multiple domains are set."
                : "."}
            </p>
          </form>
        )}
        {googleOk && (
          <div className="auth-google-wrap">
            <GoogleLogin
              hosted_domain={GOOGLE_HOSTED_DOMAIN}
              onSuccess={async (res) => {
                setLoginError(null);
                try {
                  await loginWithCredential(res.credential);
                } catch (err) {
                  setLoginError(err.message || "Sign-in failed");
                }
              }}
              onError={() =>
                setLoginError("Google sign-in was cancelled or failed")
              }
              text="signin_with"
              shape="rectangular"
              size="large"
              theme="outline"
            />
          </div>
        )}
      </div>
    </div>
  );
}
