import React, { useState } from 'react';
import axios from 'axios';
import './App1.css';

function App1() {
  const [requirement, setRequirement] = useState('');
  const [testCases, setTestCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!requirement.trim()) {
      setError('Please enter a requirement');
      return;
    }

    setLoading(true);
    setError('');
    setTestCases([]); // Clear previous results
    
    try {
      const response = await axios.post('http://127.0.0.1:8000/generate-test-cases', {
        requirement_text: requirement
      });
      
      setTestCases(response.data.test_cases);
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to generate test cases: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const exportToJSON = () => {
    const dataStr = JSON.stringify(testCases, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'test-cases.json';
    link.click();
  };

  const exportToCSV = () => {
    // Create CSV header
    const headers = ['ID', 'Title', 'Type', 'Description', 'Steps', 'Expected Result'];
    
    // Create CSV rows
    const rows = testCases.map(tc => [
      tc.id,
      tc.title,
      tc.type,
      tc.description,
      tc.steps.join(' | '),
      tc.expected_result
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'test-cases.csv';
    link.click();
  };

  const getTestTypeStats = () => {
    const stats = {
      functional: 0,
      negative: 0,
      boundary: 0,
      exploratory: 0
    };
    
    testCases.forEach(tc => {
      if (stats.hasOwnProperty(tc.type)) {
        stats[tc.type]++;
      }
    });
    
    return stats;
  };

  const stats = testCases.length > 0 ? getTestTypeStats() : null;

  return (
    <div className="App">
      <header className="App-header">
        <h1>AI Test Case Generator</h1>
        <p>Generate comprehensive test cases from requirements using AI</p>
      </header>
      
      <main className="main-content">
        {/* Input Section */}
        <div className="input-section">
          <h2>Enter Requirement</h2>
          <textarea
            value={requirement}
            onChange={(e) => setRequirement(e.target.value)}
            placeholder="Example: As a user, I want to log in with my email and password so I can access my account."
            rows="6"
            className="requirement-input"
          />
          
          <button 
            onClick={handleGenerate}
            disabled={loading}
            className="generate-button"
          >
            {loading ? '⏳ Generating...' : ' Generate Test Cases'}
          </button>

          {/* Sample requirements */}
          <div className="sample-requirements">
            <p><strong>Try these examples:</strong></p>
            <button 
              className="sample-button"
              onClick={() => setRequirement("As a user, I want to reset my password via email so that I can regain access to my account if I forget my password.")}
            >
              Password Reset
            </button>
            <button 
              className="sample-button"
              onClick={() => setRequirement("As a user, I want to search for products by name, category, or price range so that I can find items I'm interested in purchasing.")}
            >
              Product Search
            </button>
            <button 
              className="sample-button"
              onClick={() => setRequirement("As an admin, I want to view user activity logs with timestamps and actions so that I can monitor system usage and security.")}
            >
              Activity Logs
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}

        {/* Results Section */}
        {testCases.length > 0 && (
          <div className="results-section">
            {/* Stats Bar */}
            <div className="stats-bar">
              <div className="stat-item">
                <span className="stat-number">{testCases.length}</span>
                <span className="stat-label">Total Tests</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">{stats.functional}</span>
                <span className="stat-label">Functional</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">{stats.negative}</span>
                <span className="stat-label">Negative</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">{stats.boundary}</span>
                <span className="stat-label">Boundary</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">{stats.exploratory}</span>
                <span className="stat-label">Exploratory</span>
              </div>
            </div>

            {/* Export Buttons */}
            <div className="export-section">
              <h2>Generated Test Cases</h2>
              <div className="export-buttons">
                <button onClick={exportToJSON} className="export-button">
                  📄 Export JSON
                </button>
                <button onClick={exportToCSV} className="export-button">
                  📊 Export CSV
                </button>
              </div>
            </div>
            
            {/* Test Cases Display */}
            <div className="test-cases-grid">
              {testCases.map((testCase) => (
                <div key={testCase.id} className={`test-case-card ${testCase.type}`}>
                  <div className="test-case-header">
                    <h3>{testCase.title}</h3>
                    <span className={`test-type-badge ${testCase.type}`}>
                      {testCase.type}
                    </span>
                  </div>
                  
                  <p className="test-description">
                    <strong>Description:</strong> {testCase.description}
                  </p>
                  
                  <div className="test-steps">
                    <strong>Test Steps:</strong>
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
          </div>
        )}

        {/* Empty State */}
        {!loading && testCases.length === 0 && !error && (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <h3>No test cases yet</h3>
            <p>Enter a requirement above and click "Generate Test Cases" to get started!</p>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>CIS 693: Capstone @ Grand Valley </p>
      </footer>
    </div>
  );
}

export default App1;