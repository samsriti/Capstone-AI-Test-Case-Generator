import React, { useState, useEffect } from 'react';
import { MdClose, MdAutorenew } from 'react-icons/md';
import { regenerateTestCases } from '../services/api';

function EditFeatureModal({ feature, projectId, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    new_feature_name: feature.feature_name,
    requirement_text: feature.requirement_text,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        requirement_text: formData.requirement_text,
        // Only send new_feature_name if it actually changed
        ...(formData.new_feature_name.trim() !== feature.feature_name
          ? { new_feature_name: formData.new_feature_name.trim() }
          : {}),
      };
      const response = await regenerateTestCases(projectId, feature.feature_name, payload);
      onSuccess(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to regenerate test cases. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Close on ESC key
  useEffect(() => {
    const handleEscape = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit & Regenerate Feature</h2>
          <button onClick={onClose} className="modal-close-button">
            <MdClose size={24} />
          </button>
        </div>

        <p style={{ margin: '0 0 16px', color: '#666', fontSize: '14px' }}>
          Update the feature name or requirement, then regenerate. The existing
          test cases for this feature will be replaced.
        </p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Feature Name *</label>
            <input
              type="text"
              name="new_feature_name"
              value={formData.new_feature_name}
              onChange={handleChange}
              placeholder="Feature name"
              required
              maxLength={100}
            />
          </div>

          <div className="form-group">
            <label>Requirement / User Story *</label>
            <textarea
              name="requirement_text"
              value={formData.requirement_text}
              onChange={handleChange}
              placeholder="Enter the updated requirement or user story..."
              rows="7"
              required
              maxLength={3000}
            />
            <small style={{ color: '#999' }}>
              {formData.requirement_text.length} / 3000 characters
            </small>
          </div>

          <div className="modal-buttons">
            <button
              type="button"
              onClick={onClose}
              className="cancel-button"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="submit-button"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {loading ? (
                'Regenerating...'
              ) : (
                <>
                  <MdAutorenew size={18} />
                  Regenerate Test Cases
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditFeatureModal;