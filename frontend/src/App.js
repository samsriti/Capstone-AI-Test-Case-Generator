import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { getCurrentUser, isAuthenticated } from './services/api';
import { ToastProvider } from './contexts/ToastContext';  // Import ToastProvider
import Navbar from './components/Navbar';
import Login from './components/Login';
import Signup from './components/Signup';
import Dashboard from './components/Dashboard';
import CreateProject from './components/CreateProject';
import ProjectDetail from './components/ProjectDetail';
import './App.css';

// Protected Route Component
function ProtectedRoute({ children, user }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" />;
  }
  return children;
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (isAuthenticated()) {
        try {
          const response = await getCurrentUser();
          setUser(response.data);
        } catch (err) {
          console.error('Auth check failed:', err);
          localStorage.removeItem('token');
          setUser(null);
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <ToastProvider>  {/* Wrap everything with ToastProvider */}
      <Router>
        <div className="App">
          <Navbar user={user} setUser={setUser} />
          
          <Routes>
            <Route 
              path="/login" 
              element={
                isAuthenticated() ? 
                  <Navigate to="/dashboard" /> : 
                  <Login setUser={setUser} />
              } 
            />
            <Route 
              path="/signup" 
              element={
                isAuthenticated() ? 
                  <Navigate to="/dashboard" /> : 
                  <Signup />
              } 
            />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute user={user}>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/create-project"
              element={
                <ProtectedRoute user={user}>
                  <CreateProject />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectId"
              element={
                <ProtectedRoute user={user}>
                  <ProjectDetail />
                </ProtectedRoute>
              }
            />

            <Route 
              path="/" 
              element={
                isAuthenticated() ? 
                  <Navigate to="/dashboard" /> : 
                  <Navigate to="/login" />
              } 
            />
            
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </Router>
    </ToastProvider>
  );
}

export default App;