import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { logout } from '../services/api';
import { MdLogout, MdAdd } from 'react-icons/md';

function Navbar({ user, setUser }) {  // ← Add setUser prop
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    setUser(null);  // ← Clear user state!
    navigate('/login');
  };

  if (!user) return null;

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <div className="navbar-left">
          <Link to="/dashboard" className="navbar-brand">
            AI Test Case Generator
          </Link>
        </div>
        
        <div className="navbar-right">
          <span className="navbar-user">👤 {user.username}</span>
          {location.pathname === '/dashboard' && (
            <Link to="/create-project" className="navbar-button">
              <MdAdd size={18} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              New Project
            </Link>
          )}
          <button onClick={handleLogout} className="navbar-button logout">
            <MdLogout size={18} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;