import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProjects, deleteProject, updateProject } from '../services/api';
import { MdDelete, MdEdit } from 'react-icons/md';
import EditProjectModal from './EditProjectModal';

function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingProject, setEditingProject] = useState(null);  // New state

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await getProjects();
      setProjects(response.data);
    } catch (err) {
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (projectId, projectName) => {
    if (!window.confirm(`Delete "${projectName}"? This will delete all test cases.`)) {
      return;
    }

    try {
      await deleteProject(projectId);
      setProjects(projects.filter(p => p.id !== projectId));
    } catch (err) {
      alert('Failed to delete project');
    }
  };

  const handleUpdate = async (projectId, updatedData) => {
    try {
      const response = await updateProject(projectId, updatedData);
      // Update the project in the list
      setProjects(projects.map(p => 
        p.id === projectId ? response.data : p
      ));
      setEditingProject(null);
    } catch (err) {
      throw err;  // Let the modal handle the error
    }
  };

  if (loading) {
    return <div className="loading">Loading projects...</div>;
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>My Projects</h1>
        <Link to="/create-project" className="create-button">
           Create New Project
        </Link>
      </div>

      {error && <div className="error-message">{error}</div>}

      {projects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📁</div>
          <h3>No projects yet</h3>
          <p>Create your first project to start generating test cases!</p>
          <Link to="/create-project" className="create-button">
            Create Project
          </Link>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((project) => (
            <div key={project.id} className="project-card">
              <div className="project-card-header">
                <h3>{project.name}</h3>
                <div className="project-actions">
                  <button
                    onClick={() => setEditingProject(project)}
                    className="edit-icon-button"
                    title="Edit project"
                  >
                    <MdEdit size={20} />
                  </button>
                  <button
                    onClick={() => handleDelete(project.id, project.name)}
                    className="delete-icon-button"
                    title="Delete project"
                  >
                    <MdDelete size={20} />
                  </button>
                </div>
              </div>
              
              {project.description && (
                <p className="project-description">{project.description}</p>
              )}
              
              <div className="project-card-footer">
                <span className="project-date">
                  Created: {new Date(project.created_at).toLocaleDateString()}
                </span>
                <Link 
                  to={`/projects/${project.id}`} 
                  className="view-button"
                >
                  View Details →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingProject && (
        <EditProjectModal
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}

export default Dashboard;