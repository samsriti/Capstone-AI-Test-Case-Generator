import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProjects, deleteProject, updateProject } from '../services/api';
import { MdDelete, MdEdit, MdSearch } from 'react-icons/md';
import EditProjectModal from './EditProjectModal';
import { useToast } from '../contexts/ToastContext';  // Import useToast
import ConfirmDialog from './ConfirmDialog';

function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingProject, setEditingProject] = useState(null);
  const { showToast } = useToast();
  
  // New states for search and pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('date-desc'); // date-desc, date-asc, name-asc, name-desc
  const projectsPerPage = 5;

   const [confirmDelete, setConfirmDelete] = useState(null);  // { id: number, name: string }


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
    // Show confirmation dialog instead of window.confirm
    setConfirmDelete({ id: projectId, name: projectName });
  };

  const confirmDeleteProject = async () => {
    const { id, name } = confirmDelete;
    setConfirmDelete(null);  // Close dialog

    try {
      await deleteProject(id);
      setProjects(projects.filter(p => p.id !== id));
      showToast(`Deleted project "${name}"`, 'success');
    } catch (err) {
      showToast('Failed to delete project', 'error');
    }
  };

  const handleUpdate = async (projectId, updatedData) => {
    try {
      const response = await updateProject(projectId, updatedData);
      setProjects(projects.map(p => 
        p.id === projectId ? response.data : p
      ));
      setEditingProject(null);
    } catch (err) {
      throw err;
    }
  };

  // Filter projects based on search term
  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (project.description && project.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Sort projects
  const sortedProjects = [...filteredProjects].sort((a, b) => {
    switch (sortBy) {
      case 'date-desc':
        return new Date(b.created_at) - new Date(a.created_at);
      case 'date-asc':
        return new Date(a.created_at) - new Date(b.created_at);
      case 'name-asc':
        return a.name.localeCompare(b.name);
      case 'name-desc':
        return b.name.localeCompare(a.name);
      default:
        return 0;
    }
  });

  // Pagination logic
  const indexOfLastProject = currentPage * projectsPerPage;
  const indexOfFirstProject = indexOfLastProject - projectsPerPage;
  const currentProjects = sortedProjects.slice(indexOfFirstProject, indexOfLastProject);
  const totalPages = Math.ceil(sortedProjects.length / projectsPerPage);

  // Reset to page 1 when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy]);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
        <>
          {/* Search and Filter Bar */}
          <div className="projects-controls">
            <div className="search-box">
              <MdSearch size={20} className="search-icon" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="clear-search"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="sort-controls">
              <label htmlFor="sort">Sort by:</label>
              <select 
                id="sort"
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                className="sort-select"
              >
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
              </select>
            </div>
          </div>

          {/* Results summary */}
          <div className="results-summary">
            Showing {indexOfFirstProject + 1}-{Math.min(indexOfLastProject, sortedProjects.length)} of {sortedProjects.length} project{sortedProjects.length !== 1 ? 's' : ''}
            {searchTerm && ` matching "${searchTerm}"`}
          </div>

          {/* Projects Grid */}
          {currentProjects.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <h3>No projects found</h3>
              <p>Try adjusting your search term</p>
              <button onClick={() => setSearchTerm('')} className="create-button">
                Clear Search
              </button>
            </div>
          ) : (
            <div className="projects-grid">
              {currentProjects.map((project) => (
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="pagination-button"
              >
                ← Previous
              </button>

              <div className="pagination-numbers">
                {[...Array(totalPages)].map((_, index) => {
                  const pageNumber = index + 1;
                  // Show first page, last page, current page, and pages around current
                  if (
                    pageNumber === 1 ||
                    pageNumber === totalPages ||
                    (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={pageNumber}
                        onClick={() => handlePageChange(pageNumber)}
                        className={`pagination-number ${currentPage === pageNumber ? 'active' : ''}`}
                      >
                        {pageNumber}
                      </button>
                    );
                  } else if (
                    pageNumber === currentPage - 2 ||
                    pageNumber === currentPage + 2
                  ) {
                    return <span key={pageNumber} className="pagination-ellipsis">...</span>;
                  }
                  return null;
                })}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="pagination-button"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {editingProject && (
        <EditProjectModal
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onUpdate={handleUpdate}
        />
      )}

      {/* Confirmation Dialog */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete Project"
          message={`Are you sure you want to delete "${confirmDelete.name}"? This will permanently delete all features and test cases.`}
          confirmText="Delete Project"
          cancelText="Cancel"
          type="danger"
          onConfirm={confirmDeleteProject}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

export default Dashboard;