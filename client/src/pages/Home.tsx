import React, { useState } from 'react';
import Header from "../features/shell/Header";
import AddPlace from "../features/places/AddPlace";
import PlaceList from "../features/places/PlaceList";
import PlaceListWorkbench from "../features/places/PlaceListWorkbench";

const Home = () => {
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <div className="home-root">
      <Header onAddClick={() => setShowAddModal(true)} />
      <div className="home-lists-main-row">
        <PlaceListWorkbench />
        <div className="home-place-list-wrap">
          <PlaceList />
        </div>
      </div>
      <AddPlace
        showModal={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
    </div>
  );
};

export default Home