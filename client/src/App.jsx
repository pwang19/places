import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./routes/Home";
import PlaceDetailsPage from "./routes/PlaceDetailsPage";
import { PlacesContextProvider } from "./context/PlacesContext";
import "./styles/modern.css";

const App = () => {
  return (
    <PlacesContextProvider>
      <div className="container">
        <Router>
          <Routes>
            <Route exact path="/" element={<Home />} />
            <Route exact path="/places/:id" element={<PlaceDetailsPage />} />
            <Route path="*" element={<h1>Page Not Found</h1>} />
          </Routes>
        </Router>
      </div>
    </PlacesContextProvider>
  );
};

export default App;
