import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import About from './pages/About';
import Approval from './pages/Approval';
import HowItWorks from './pages/HowItWorks';
import Home from './pages/Home';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Request from './pages/Request';
import Settings from './pages/Settings';
import Signin from './pages/Signin';
import Swappers from './pages/Swappers';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/approval" element={<Approval />} />
        <Route path="/howitworks" element={<HowItWorks />} />
        <Route path="/login" element={<Login />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/request" element={<Request />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/signin" element={<Signin />} />
        <Route path="/swappers" element={<Swappers />} />
      </Routes>
    </Router>
  );
}

export default App;
