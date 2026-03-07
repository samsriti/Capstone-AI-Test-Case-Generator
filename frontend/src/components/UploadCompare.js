import React, { useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { previewCompare, uploadAndCompare } from '../services/api';
import GapReport from './GapReport';
import { MdUploadFile, MdCheckCircle, MdError, MdArrowBack, MdArrowForward } from 'react-icons/md';

// Pipeline stages shown while the final comparison is running
const STAGES = [
  'Uploading file',
  'Normalizing test cases',
  'Applying feature mapping',
  'Retrieving AI test cases',
  'Computing semantic embeddings',
  'Matching test cases',
  'Generating gap report',
];

// Confidence label for a mapping suggestion similarity score
function confidenceLabel(sim) {
  if (sim >= 0.80) return { text: 'High',   cls: 'conf-high'   };
  if (sim >= 0.55) return { text: 'Medium', cls: 'conf-medium' };
  return               { text: 'Low',    cls: 'conf-low'    };
}

// ── Step 1: Upload ────────────────────────────────────────────────────────────
function StepUpload({ file, setFile, onNext, loading, error }) {
  const fileInputRef = useRef(null);
  const [dragging, setDragging]= useState(false);

  const acceptFile = (f) => {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['csv', 'json', 'txt'].includes(ext)) {
      return;   // parent handles error via API response
    }
    setFile(f);
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    acceptFile(e.dataTransfer.files[0]);
  }, []);

  return (
    <div className="uc-card">
      <h2 className="uc-step-title">Step 1 — Upload your test suite</h2>

      <div
        className={`uc-dropzone${dragging ? ' uc-dropzone--active' : ''}${file ? ' uc-dropzone--has-file' : ''}`}
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => !file && fileInputRef.current?.click()}
        role="button" tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && !file && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json,.txt"
          onChange={(e) => acceptFile(e.target.files[0])}
          style={{ display: 'none' }}
        />

        {file ? (
          <div className="uc-file-selected">
            <MdCheckCircle className="uc-file-icon uc-file-icon--ok" size={36} />
            <span className="uc-file-name">{file.name}</span>
            <span className="uc-file-size">
              {file.size < 1024 * 1024
                ? `${(file.size / 1024).toFixed(1)} KB`
                : `${(file.size / 1024 / 1024).toFixed(1)} MB`}
            </span>
            <button className="uc-change-file" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
              Change file
            </button>
          </div>
        ) : (
          <div className="uc-drop-prompt">
            <MdUploadFile size={48} className="uc-upload-icon" />
            <p className="uc-drop-text">Drag &amp; drop your file here</p>
            <p className="uc-drop-sub">or click to browse</p>
            <p className="uc-drop-formats">CSV &bull; JSON &bull; TXT</p>
          </div>
        )}
      </div>

      <details className="uc-format-hint">
        <summary>Expected file format</summary>
        <div className="uc-format-body">
          <p><strong>CSV</strong> — one test case per row. Recognised columns:</p>
          <code>feature, title, description, steps, expected_result</code>
          <p>The <code>feature</code> column drives the mapping step. Without it, semantic search is used.</p>
          <p><strong>JSON</strong> — array of objects with the same keys.</p>
          <p><strong>TXT</strong> — one test-case title per line.</p>
        </div>
      </details>

      {error && (
        <div className="uc-error"><MdError size={18} /><span>{error}</span></div>
      )}

      <div className="uc-actions">
        <button className="uc-submit-btn" onClick={onNext} disabled={!file || loading}>
          {loading ? 'Analyzing file…' : <>Next — Map features <MdArrowForward size={16} /></>}
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Map features ──────────────────────────────────────────────────────
function StepMapFeatures({ preview, featureMap, setFeatureMap, onBack, onRun, loading, error }) {
  const { uploaded_features, project_features, total_cases, has_feature_column } = preview;

  const handleMapChange = (uploadedName, projectName) => {
    setFeatureMap(prev => ({ ...prev, [uploadedName]: projectName }));
  };

  return (
    <div className="uc-card">
      <h2 className="uc-step-title">Step 2 — Map features</h2>
      <p className="uc-step-desc">
        {has_feature_column
          ? `Your file contains ${uploaded_features.length} unique feature name${uploaded_features.length !== 1 ? 's' : ''}.
             Map each one to the corresponding project feature. We pre-filled suggestions based on semantic similarity.`
          : `No feature column was detected — all ${total_cases} test cases will be mapped to project features using semantic similarity.`}
      </p>

      {has_feature_column && (
        <div className="uc-mapping-table">
          <div className="uc-mapping-header">
            <span>Your file's feature name</span>
            <span>Maps to project feature</span>
            <span>Confidence</span>
          </div>

          {uploaded_features.map((item) => {
            const conf = confidenceLabel(item.similarity);
            const currentVal = featureMap[item.uploaded_feature] ?? item.suggested_project_feature ?? '';
            return (
              <div key={item.uploaded_feature} className="uc-mapping-row">
                <span className="uc-mapping-source">{item.uploaded_feature}</span>

                <select
                  className="uc-mapping-select"
                  value={currentVal}
                  onChange={(e) => handleMapChange(item.uploaded_feature, e.target.value)}
                >
                  <option value="">— leave unmapped —</option>
                  {project_features.map((pf) => (
                    <option key={pf} value={pf}>{pf}</option>
                  ))}
                </select>

                <span className={`uc-conf-badge ${conf.cls}`}>
                  {conf.text} ({Math.round(item.similarity * 100)}%)
                </span>
              </div>
            );
          })}
        </div>
      )}

      {!has_feature_column && (
        <div className="uc-no-feature-notice">
          <p>The semantic engine will automatically route each test case to the best-matching
             project feature. You can still run the comparison without manual mapping.</p>
        </div>
      )}

      {error && (
        <div className="uc-error"><MdError size={18} /><span>{error}</span></div>
      )}

      {loading && (
        <div className="uc-stages">
          {STAGES.map((label, i) => (
            <div key={i} className="uc-stage uc-stage--active">
              <span className="uc-stage-bullet"><span className="uc-stage-num">{i + 1}</span></span>
              <span className="uc-stage-label">{label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="uc-actions uc-actions--spaced">
        <button className="uc-back-btn-action" onClick={onBack} disabled={loading}>
          <MdArrowBack size={16} /> Back
        </button>
        <button className="uc-submit-btn" onClick={onRun} disabled={loading}>
          {loading ? 'Running comparison…' : 'Run Comparison'}
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
function UploadCompare() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  // step: 'upload' | 'map' | 'report'
  const [step, setStep]           = useState('upload');
  const [file, setFile]           = useState(null);
  const [preview, setPreview]     = useState(null);
  const [featureMap, setFeatureMap] = useState({});
  const [report, setReport]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  // Step 1 → 2: call preview endpoint
  const handlePreview = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await previewCompare(projectId, file);
      const data = res.data;

      // Pre-fill featureMap with suggested mappings that have a suggestion
      const initial = {};
      (data.uploaded_features || []).forEach((item) => {
        if (item.suggested_project_feature) {
          initial[item.uploaded_feature] = item.suggested_project_feature;
        }
      });
      setFeatureMap(initial);
      setPreview(data);
      setStep('map');
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not analyze file. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2 → 3: run full comparison
  const handleRun = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await uploadAndCompare(projectId, file, featureMap);
      setReport(res.data);
      setStep('report');
    } catch (err) {
      setError(err.response?.data?.detail || 'Comparison failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRunAgain = () => {
    setStep('upload');
    setFile(null);
    setPreview(null);
    setFeatureMap({});
    setReport(null);
    setError('');
  };

  // Step indicator
  const steps = ['Upload', 'Map features', 'Gap report'];
  const stepIdx = step === 'upload' ? 0 : step === 'map' ? 1 : 2;

  return (
    <div className="upload-compare-page">
      <div className="upload-compare-container">

        {/* Page header */}
        <div className="uc-header">
          <button className="uc-back-btn" onClick={() => navigate(`/projects/${projectId}`)}>
            <MdArrowBack size={18} /> Back to project
          </button>
          <h1 className="uc-title">Upload &amp; Compare</h1>
          <p className="uc-subtitle">
            Upload your existing test suite and compare it against AI-generated cases
            using semantic embeddings — surfacing gaps, redundancies, and uncovered scenarios.
          </p>
        </div>

        {/* Step indicator */}
        {step !== 'report' && (
          <div className="uc-stepper">
            {steps.map((label, i) => (
              <React.Fragment key={label}>
                <div className={`uc-step-dot${i < stepIdx ? ' done' : i === stepIdx ? ' active' : ''}`}>
                  {i < stepIdx ? <MdCheckCircle size={18} /> : <span>{i + 1}</span>}
                  <span className="uc-step-label">{label}</span>
                </div>
                {i < steps.length - 1 && <div className={`uc-step-line${i < stepIdx ? ' done' : ''}`} />}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Step content */}
        {step === 'upload' && (
          <StepUpload
            file={file} setFile={setFile}
            onNext={handlePreview}
            loading={loading} error={error}
          />
        )}

        {step === 'map' && preview && (
          <StepMapFeatures
            preview={preview}
            featureMap={featureMap} setFeatureMap={setFeatureMap}
            onBack={() => { setStep('upload'); setError(''); }}
            onRun={handleRun}
            loading={loading} error={error}
          />
        )}

        {step === 'report' && report && (
          <GapReport report={report} onRunAgain={handleRunAgain} />
        )}
      </div>
    </div>
  );
}

export default UploadCompare;
