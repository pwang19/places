import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "../../pages/Home";
import PlaceDetailsPage from "../../pages/PlaceDetailsPage";
import { PlacesContextProvider } from "../../context/PlacesContext";
import { useAuth } from "../../context/AuthContext";
import LoginScreen from "../auth/LoginScreen";

export default function AppShell() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-gate">
        <div className="auth-card auth-card--plain">
          <p className="auth-loading">Checking sign-in…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <PlacesContextProvider>
      <div className="container">
        <Router>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/places/:id" element={<PlaceDetailsPage />} />
            <Route path="*" element={<h1>Page Not Found</h1>} />
          </Routes>
        </Router>
      </div>
    </PlacesContextProvider>
  );
}
