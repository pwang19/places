import React from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "./context/AuthContext";
import AppShell from "./components/AppShell";
import "./styles/modern.css";

const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";

function AppProviders({ children }) {
  if (!googleClientId) {
    return <AuthProvider>{children}</AuthProvider>;
  }
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthProvider>{children}</AuthProvider>
    </GoogleOAuthProvider>
  );
}

const App = () => {
  return (
    <AppProviders>
      <AppShell />
    </AppProviders>
  );
};

export default App;
