import React, { useState } from 'react';
import Header from '../components/Header';
import AddPlace from '../components/AddPlace';
import PlaceList from '../components/PlaceList';
import PlaceListWorkbench from '../components/PlaceListWorkbench';

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