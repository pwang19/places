import React from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "./context/AuthContext";
import AppShell from "./features/shell/AppShell";
import "./styles/modern.css";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

function AppProviders({ children }: { children: React.ReactNode }) {
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
