import React, { useState } from 'react';
import { generateTestCases } from '../services/api';

function GenerateTestCases({ projectId, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    feature_name: '',
    requirement_text: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await generateTestCases(projectId, formData);
      onSuccess(response.data);
      
      // Reset form
      setFormData({
        feature_name: '',
        requirement_text: ''
      });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to generate test cases');
    } finally {
      setLoading(false);
    }
  };

  // Sample requirements for quick testing
  const sampleRequirements = [
    {
      feature: "User Login",
      text: "As a user, I want to log in with my email and password so I can securely access my account. The system should validate credentials, handle incorrect passwords, and lock accounts after 5 failed attempts."
    },
    {
      feature: "User Signup",
      text: "As a new user, I want to create an account with email, username, and password so I can start using the application. The system should validate email format, ensure password strength, and check for duplicate usernames."
    },
    {
      feature: "Shopping Cart",
      text: "As a shopper, I want to add items to my cart, update quantities, and remove items so I can manage my purchases before checkout. The cart should persist across sessions and calculate totals correctly."
    }
  ];

  const applySample = (sample) => {
  setFormData({
    feature_name: sample.feature,
    requirement_text: sample.text
  });
};

  return (
    <div className="generate-test-cases-form">
      <h2>Generate Test Cases for New Feature</h2>
      <p className="subtitle">
        Add a new feature to this project and generate comprehensive test cases using AI.
      </p>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Feature Name *</label>
          <input
            type="text"
            name="feature_name"
            value={formData.feature_name}
            onChange={handleChange}
            placeholder="e.g., User Login, Shopping Cart, Payment Processing"
            required
          />
        </div>

        <div className="form-group">
          <label>Requirement / User Story *</label>
          <textarea
            name="requirement_text"
            value={formData.requirement_text}
            onChange={handleChange}
            placeholder="Enter the requirement or user story for this feature..."
            rows="6"
            required
          />
        </div>

        {/* Sample requirements */}
        <div className="sample-requirements">
          <p><strong>Quick samples:</strong></p>
          <div className="sample-buttons">
            {sampleRequirements.map((sample, idx) => (
              <button
  key={idx}
  type="button"
  onClick={() => applySample(sample)}  // ← Changed from useSample
  className="sample-button"
>
  {sample.feature}
</button>
            ))}
          </div>
        </div>

        <div className="form-buttons">
          <button
            type="button"
            onClick={onCancel}
            className="cancel-button"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="submit-button"
          >
            {loading ? 'Generating Test Cases...' : 'Generate Test Cases'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default GenerateTestCases;