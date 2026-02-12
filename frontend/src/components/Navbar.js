import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { logout } from '../services/api';
import { MdLogout, MdAdd } from 'react-icons/md';

function Navbar({ user, setUser }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    setUser(null);
    navigate('/login');
  };

  if (!user) return null;

  // Get first letter of username and capitalize it
  const initial = user.username.charAt(0).toUpperCase();

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <div className="navbar-left">
          <Link to="/dashboard" className="navbar-brand">
            TCGAI
          </Link>
        </div>
        
        <div className="navbar-right">
          <div className="user-avatar" title={`Hi, ${user.username}`}>
            {initial}
          </div>
          {location.pathname === '/dashboard' && (
            <Link to="/create-project" className="navbar-button">
              <MdAdd size={18} />
              New Project
            </Link>
          )}
          <button onClick={handleLogout} className="navbar-button logout">
            <MdLogout size={18} />
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;