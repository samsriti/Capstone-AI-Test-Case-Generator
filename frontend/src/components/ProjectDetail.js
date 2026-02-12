import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProject, deleteFeature } from '../services/api';
import GenerateTestCases from './GenerateTestCases';
import ConfirmDialog from './ConfirmDialog';  // Import ConfirmDialog
import { MdDelete, MdSearch } from 'react-icons/md';
import { useToast } from '../contexts/ToastContext';  // Import useToast

function ProjectDetail() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [expandedFeatures, setExpandedFeatures] = useState({});
  const { showToast } = useToast();

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, functional, negative, boundary, exploratory

  const [confirmDelete, setConfirmDelete] = useState(null);  // { featureName: string }

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  const fetchProject = async () => {
    try {
      const response = await getProject(projectId);
      setProject(response.data);
      
      // Expand all features by default
      const expanded = {};
      response.data.features?.forEach(feature => {
        expanded[feature.feature_name] = true;
      });
      setExpandedFeatures(expanded);
    } catch (err) {
      setError('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSuccess = (data) => {
    setShowGenerateForm(false);
    fetchProject();
    showToast(`Generated ${data.test_cases_count} test cases for "${data.feature_name}"`, 'success');  // Replace alert
  };

const handleDeleteFeature = async (featureName) => {
    // Show confirmation dialog instead of window.confirm
    setConfirmDelete({ featureName });
  };

  const confirmDeleteFeature = async () => {
    const featureName = confirmDelete.featureName;
    setConfirmDelete(null);  // Close dialog

    try {
      await deleteFeature(projectId, featureName);
      fetchProject();
      showToast(`Deleted all test cases for "${featureName}"`, 'success');
    } catch (err) {
      showToast('Failed to delete feature', 'error');
    }
  };

  const toggleFeature = (featureName) => {
    setExpandedFeatures({
      ...expandedFeatures,
      [featureName]: !expandedFeatures[featureName]
    });
  };

  const exportToJSON = () => {
    const dataStr = JSON.stringify(project, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.name.replace(/\s+/g, '_')}_test_cases.json`;
    link.click();
  };

  const exportToCSV = () => {
    const headers = ['Feature', 'Test ID', 'Title', 'Type', 'Description', 'Steps', 'Expected Result'];
    
    const rows = [];
    project.features.forEach(feature => {
      feature.test_cases.forEach(tc => {
        rows.push([
          feature.feature_name,
          tc.id,
          tc.title,
          tc.type,
          tc.description,
          tc.steps.join(' | '),
          tc.expected_result
        ]);
      });
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.name.replace(/\s+/g, '_')}_test_cases.csv`;
    link.click();
  };

  const getTypeColor = (type) => {
    const colors = {
      functional: '#4caf50',
      negative: '#f44336',
      boundary: '#ff9800',
      exploratory: '#2196f3'
    };
    return colors[type] || '#667eea';
  };

  // Filter features and test cases based on search and filter
  const getFilteredFeatures = () => {
    if (!project?.features) return [];

    return project.features
      .map(feature => {
        // Filter test cases by type
        let filteredTestCases = feature.test_cases;
        if (filterType !== 'all') {
          filteredTestCases = filteredTestCases.filter(tc => tc.type === filterType);
        }

        // Filter by search term
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          
          // Check if feature name matches
          const featureNameMatches = feature.feature_name.toLowerCase().includes(searchLower);
          const requirementMatches = feature.requirement_text.toLowerCase().includes(searchLower);
          
          // Filter test cases that match search
          const matchingTestCases = filteredTestCases.filter(tc =>
            tc.title.toLowerCase().includes(searchLower) ||
            tc.description.toLowerCase().includes(searchLower) ||
            tc.expected_result.toLowerCase().includes(searchLower) ||
            tc.steps.some(step => step.toLowerCase().includes(searchLower))
          );

          // If feature name/requirement matches, show all test cases
          // Otherwise, only show matching test cases
          if (featureNameMatches || requirementMatches) {
            return { ...feature, test_cases: filteredTestCases };
          } else if (matchingTestCases.length > 0) {
            return { ...feature, test_cases: matchingTestCases };
          } else {
            return null; // Feature doesn't match
          }
        }

        return { ...feature, test_cases: filteredTestCases };
      })
      .filter(feature => feature !== null && feature.test_cases.length > 0);
  };

  const filteredFeatures = getFilteredFeatures();
  const totalFilteredTestCases = filteredFeatures.reduce((sum, f) => sum + f.test_cases.length, 0);

  if (loading) {
    return <div className="loading">Loading project...</div>;
  }

  if (error || !project) {
    return (
      <div className="error-container">
        <div className="error-message">{error || 'Project not found'}</div>
        <button onClick={() => navigate('/dashboard')} className="back-button">
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  const totalTestCases = project.features?.reduce((sum, f) => sum + f.test_cases.length, 0) || 0;

  return (
    <div className="project-detail-container">
      {/* Project Header */}
      <div className="project-header">
        <button onClick={() => navigate('/dashboard')} className="back-button">
          ← Back to Dashboard
        </button>
        
        <div className="project-title-section">
          <h1>{project.name}</h1>
          {project.description && <p className="project-description">{project.description}</p>}
        </div>

        <div className="project-stats">
          <div className="stat-item">
            <span className="stat-number">{project.features?.length || 0}</span>
            <span className="stat-label">Features</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{totalTestCases}</span>
            <span className="stat-label">Test Cases</span>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="actions-bar">
        <button
          onClick={() => setShowGenerateForm(!showGenerateForm)}
          className="primary-button"
        >
          {showGenerateForm ? '✖ Cancel' : ' Add Feature & Generate Test Cases'}
        </button>
        
        {totalTestCases > 0 && (
          <div className="export-buttons">
            <button onClick={exportToJSON} className="export-button">
              📄 Export JSON
            </button>
            <button onClick={exportToCSV} className="export-button">
              📊 Export CSV
            </button>
          </div>
        )}
      </div>

      {/* Generate Form */}
      {showGenerateForm && (
        <div className="generate-form-section">
          <GenerateTestCases
            projectId={projectId}
            onSuccess={handleGenerateSuccess}
            onCancel={() => setShowGenerateForm(false)}
          />
        </div>
      )}

      {/* Search and Filter Controls */}
      {project.features && project.features.length > 0 && (
        <div className="project-detail-controls">
          <div className="search-box">
            <MdSearch size={20} className="search-icon" />
            <input
              type="text"
              placeholder="Search features and test cases..."
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

          <div className="filter-controls">
            <label>Filter by type:</label>
            <div className="filter-buttons">
              <button
                onClick={() => setFilterType('all')}
                className={`filter-button ${filterType === 'all' ? 'active' : ''}`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('functional')}
                className={`filter-button ${filterType === 'functional' ? 'active' : ''}`}
              >
                Functional
              </button>
              <button
                onClick={() => setFilterType('negative')}
                className={`filter-button ${filterType === 'negative' ? 'active' : ''}`}
              >
                Negative
              </button>
              <button
                onClick={() => setFilterType('boundary')}
                className={`filter-button ${filterType === 'boundary' ? 'active' : ''}`}
              >
                Boundary
              </button>
              <button
                onClick={() => setFilterType('exploratory')}
                className={`filter-button ${filterType === 'exploratory' ? 'active' : ''}`}
              >
                Exploratory
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results Summary */}
      {(searchTerm || filterType !== 'all') && project.features && project.features.length > 0 && (
        <div className="results-summary">
          Showing {totalFilteredTestCases} test case{totalFilteredTestCases !== 1 ? 's' : ''} 
          {searchTerm && ` matching "${searchTerm}"`}
          {filterType !== 'all' && ` of type "${filterType}"`}
        </div>
      )}

      {/* Features List */}
      {filteredFeatures.length > 0 ? (
        <div className="features-list">
          {filteredFeatures.map((feature) => (
            <div key={feature.feature_name} className="feature-section">
              <div className="feature-header">
                <div 
                  className="feature-title-area"
                  onClick={() => toggleFeature(feature.feature_name)}
                >
                  <span className="expand-icon">
                    {expandedFeatures[feature.feature_name] ? '▼' : '▶'}
                  </span>
                  <h2>{feature.feature_name}</h2>
                  <span className="test-count-badge">
                    {feature.test_cases.length} test case{feature.test_cases.length !== 1 ? 's' : ''}
                  </span>
                </div>
                
                <button
                  onClick={() => handleDeleteFeature(feature.feature_name)}
                  className="delete-icon-button"
                  title="Delete this feature"
                >
                  <MdDelete size={20} />
                </button>
              </div>

              {expandedFeatures[feature.feature_name] && (
                <>
                  <div className="feature-requirement">
                    <strong>Requirement:</strong>
                    <p>{feature.requirement_text}</p>
                  </div>

                  {/* Test Type Distribution */}
                  <div className="test-type-stats">
                    {['functional', 'negative', 'boundary', 'exploratory'].map(type => {
                      const count = feature.test_cases.filter(tc => tc.type === type).length;
                      if (count === 0) return null;
                      return (
                        <div key={type} className="type-stat">
                          <span 
                            className="type-dot" 
                            style={{ backgroundColor: getTypeColor(type) }}
                          />
                          <span className="type-label">{type}: {count}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Test Cases Grid */}
                  <div className="test-cases-grid">
                    {feature.test_cases.map((testCase) => (
                      <div 
                        key={testCase.id} 
                        className="test-case-card"
                        style={{ borderLeftColor: getTypeColor(testCase.type) }}
                      >
                        <div className="test-case-header">
                          <h3>{testCase.title}</h3>
                          <span 
                            className="test-type-badge"
                            style={{
                              backgroundColor: `${getTypeColor(testCase.type)}20`,
                              color: getTypeColor(testCase.type)
                            }}
                          >
                            {testCase.type}
                          </span>
                        </div>

                        <p className="test-description">
                          <strong>Description:</strong> {testCase.description}
                        </p>

                        <div className="test-steps">
                          <strong>Steps:</strong>
                          <ol>
                            {testCase.steps.map((step, idx) => (
                              <li key={idx}>{step}</li>
                            ))}
                          </ol>
                        </div>

                        <div className="expected-result">
                          <strong>Expected Result:</strong>
                          <p>{testCase.expected_result}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          {searchTerm || filterType !== 'all' ? (
            <>
              <div className="empty-icon">🔍</div>
              <h3>No matching test cases found</h3>
              <p>Try adjusting your search or filter</p>
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setFilterType('all');
                }}
                className="create-button"
              >
                Clear Filters
              </button>
            </>
          ) : (
            <>
              <div className="empty-icon">📝</div>
              <h3>No features yet</h3>
              <p>Click "Add Feature & Generate Test Cases" to get started!</p>
            </>
          )}
        </div>
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete Feature"
          message={`Are you sure you want to delete all test cases for "${confirmDelete.featureName}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          type="danger"
          onConfirm={confirmDeleteFeature}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

export default ProjectDetail;