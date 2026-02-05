import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
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
    
    try {
      const response = await axios.post('http://127.0.0.1:8000/generate-test-cases', {
        requirement_text: requirement
      });
      
      setTestCases(response.data.test_cases);
    } catch (err) {
      setError('Failed to generate test cases: ' + err.message);
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

  return (
    <div className="App">
      <header className="App-header">
        <h1>AI Test Case Generator</h1>
      </header>
      
      <main style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '20px' }}>
          <h2>Enter Requirement</h2>
          <textarea
            value={requirement}
            onChange={(e) => setRequirement(e.target.value)}
            placeholder="Enter user story or requirement here..."
            rows="6"
            style={{ width: '100%', padding: '10px', fontSize: '16px' }}
          />
          
          <button 
            onClick={handleGenerate}
            disabled={loading}
            style={{
              marginTop: '10px',
              padding: '10px 20px',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            {loading ? 'Generating...' : 'Generate Test Cases'}
          </button>
        </div>

        {error && <div style={{ color: 'red' }}>{error}</div>}

        {testCases.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Generated Test Cases ({testCases.length})</h2>
              <button onClick={exportToJSON}>Export to JSON</button>
            </div>
            
            {testCases.map((testCase) => (
              <div key={testCase.id} style={{
                border: '1px solid #ccc',
                padding: '15px',
                marginBottom: '15px',
                borderRadius: '5px'
              }}>
                <h3>{testCase.title}</h3>
                <p><strong>Type:</strong> <span style={{
                  padding: '3px 8px',
                  borderRadius: '3px',
                  background: getTypeColor(testCase.type)
                }}>{testCase.type}</span></p>
                <p><strong>Description:</strong> {testCase.description}</p>
                <p><strong>Steps:</strong></p>
                <ol>
                  {testCase.steps.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
                <p><strong>Expected Result:</strong> {testCase.expected_result}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function getTypeColor(type) {
  const colors = {
    functional: '#d4edda',
    negative: '#f8d7da',
    boundary: '#fff3cd',
    exploratory: '#d1ecf1'
  };
  return colors[type] || '#e9ecef';
}

export default App;