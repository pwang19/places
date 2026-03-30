import React, { useState } from 'react';
import Header from '../components/Header';
import AddPlace from '../components/AddPlace';
import PlaceList from '../components/PlaceList';

const Home = () => {
  const [showAddModal, setShowAddModal] = useState(false);

  return <div>
    <Header onAddClick={() => setShowAddModal(true)} />
    <PlaceList />
    <AddPlace 
      showModal={showAddModal} 
      onClose={() => setShowAddModal(false)} 
    />
  </div>
}

export default Home