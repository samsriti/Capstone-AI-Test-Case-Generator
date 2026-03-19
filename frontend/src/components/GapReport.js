import React, { useState } from 'react';
import {
  MdCheckCircle, MdAutorenew, MdWarning, MdContentCopy,
  MdExpandMore, MdExpandLess, MdBarChart, MdSwapHoriz, MdDownload,
} from 'react-icons/md';

// ── CSV helpers ────────────────────────────────────────────────────────────────

function csvCell(v) { return `"${String(v ?? '').replace(/"/g, '""')}"`; }
function csvRow(...cells) { return cells.map(csvCell).join(','); }

function downloadCSV(filename, rows) {
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function featureToRows(feat) {
  const exact    = `${feat.exact_coverage_pct.toFixed(1)}%`;
  const adjusted = `${feat.adjusted_coverage_pct.toFixed(1)}%`;
  const rows = [];
  // Coverage summary row for this feature
  rows.push(csvRow(feat.feature_name, 'Coverage Summary', `${feat.manual_cases_count} manual / ${feat.ai_cases_count} AI`, '', '', exact, adjusted));
  feat.matched.forEach(m =>
    rows.push(csvRow(feat.feature_name, 'Matched', m.manual_title, m.ai_title, `${(m.similarity * 100).toFixed(1)}%`, '', ''))
  );
  feat.near_misses.forEach(m =>
    rows.push(csvRow(feat.feature_name, 'Near-miss', m.manual_title, m.closest_ai_title, `${(m.similarity * 100).toFixed(1)}%`, '', ''))
  );
  feat.ai_only.forEach(t =>
    rows.push(csvRow(feat.feature_name, 'AI-only gap', '', t, '', '', ''))
  );
  feat.manual_only.forEach(t =>
    rows.push(csvRow(feat.feature_name, 'Manual-only', t, '', '', '', ''))
  );
  feat.redundant_pairs.forEach(r =>
    rows.push(csvRow(feat.feature_name, 'Redundant', r.case_a, r.case_b, `${(r.similarity * 100).toFixed(1)}%`, '', ''))
  );
  return rows;
}

const CSV_HEADER = csvRow('Feature', 'Category', 'Manual / Case A', 'AI / Case B', 'Similarity', 'Exact Coverage', 'Adjusted Coverage');

// ── Small helpers ─────────────────────────────────────────────────────────────

function pct(n) { return `${n.toFixed(1)}%`; }

function CoverageBar({ value }) {
  const color = value >= 75 ? '#22c55e' : value >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div className="gr-bar-track">
      <div className="gr-bar-fill" style={{ width: `${Math.min(value, 100)}%`, background: color }} />
      <span className="gr-bar-label">{pct(value)}</span>
    </div>
  );
}

function Badge({ type, count }) {
  const map = {
    matched:   { label: 'Matched',      cls: 'gr-badge--matched'    },
    near_miss: { label: 'Near-miss',    cls: 'gr-badge--near-miss'  },
    ai_only:   { label: 'AI-only gaps', cls: 'gr-badge--ai-only'    },
    manual:    { label: 'Manual-only',  cls: 'gr-badge--manual'     },
    redundant: { label: 'Redundant',    cls: 'gr-badge--redundant'  },
  };
  const { label, cls } = map[type];
  return <span className={`gr-badge ${cls}`}>{count} {label}</span>;
}

// ── Feature drill-down section ────────────────────────────────────────────────

function FeatureSection({ feat }) {
  const [open, setOpen] = useState(feat.adjusted_coverage_pct < 80);

  const handleDownload = (e) => {
    e.stopPropagation();
    const rows = [CSV_HEADER, ...featureToRows(feat)];
    downloadCSV(`gap-report-${feat.feature_name.replace(/\s+/g, '_')}.csv`, rows);
  };

  return (
    <div className="gr-feature">
      <button className="gr-feature-header" onClick={() => setOpen(o => !o)}>
        <div className="gr-feature-title-row">
          <span className="gr-feature-name">{feat.feature_name}</span>
          <div className="gr-feature-badges">
            <Badge type="matched"   count={feat.matched.length} />
            {feat.near_misses.length > 0 &&
              <Badge type="near_miss" count={feat.near_misses.length} />}
            <Badge type="ai_only"   count={feat.ai_only.length} />
            <Badge type="manual"    count={feat.manual_only.length} />
            {feat.redundant_pairs.length > 0 &&
              <Badge type="redundant" count={feat.redundant_pairs.length} />}
          </div>
        </div>
        <div className="gr-feature-bar-row">
          <CoverageBar value={feat.adjusted_coverage_pct} />
          <span className="gr-feature-counts">
            {feat.manual_cases_count} manual / {feat.ai_cases_count} AI
            {feat.exact_coverage_pct !== feat.adjusted_coverage_pct &&
              <span className="gr-coverage-tiers">
                &nbsp;· exact {feat.exact_coverage_pct}% / adj {feat.adjusted_coverage_pct}%
              </span>}
          </span>
          {open ? <MdExpandLess size={20} /> : <MdExpandMore size={20} />}
        </div>
      </button>
      <button className="gr-download-btn" onClick={handleDownload} title="Download this feature's report">
        <MdDownload size={16} /> CSV
      </button>

      {open && (
        <div className="gr-feature-body">

          {/* Matched */}
          {feat.matched.length > 0 && (
            <div className="gr-section">
              <h4 className="gr-section-title gr-section-title--matched">
                <MdCheckCircle size={16} /> Matched ({feat.matched.length})
              </h4>
              <table className="gr-table">
                <thead>
                  <tr><th>Your test case</th><th>AI counterpart</th><th>Similarity</th></tr>
                </thead>
                <tbody>
                  {feat.matched.map((m, i) => (
                    <tr key={i}>
                      <td>{m.manual_title}</td>
                      <td>{m.ai_title}</td>
                      <td><span className="gr-sim-chip gr-sim-chip--high">{pct(m.similarity * 100)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Near-misses */}
          {feat.near_misses.length > 0 && (
            <div className="gr-section">
              <h4 className="gr-section-title gr-section-title--near-miss">
                <MdSwapHoriz size={16} /> Possible matches — same scenario, different wording ({feat.near_misses.length})
              </h4>
              <p className="gr-section-hint">
                These pairs cover the same scenario but use different terminology.
                Similarity is between 52–70% — review and consider consolidating phrasing.
              </p>
              <table className="gr-table">
                <thead>
                  <tr><th>Your test case</th><th>Closest AI case</th><th>Similarity</th></tr>
                </thead>
                <tbody>
                  {feat.near_misses.map((m, i) => (
                    <tr key={i}>
                      <td>{m.manual_title}</td>
                      <td>{m.closest_ai_title}</td>
                      <td><span className="gr-sim-chip gr-sim-chip--near">{pct(m.similarity * 100)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* AI-only gaps */}
          {feat.ai_only.length > 0 && (
            <div className="gr-section">
              <h4 className="gr-section-title gr-section-title--ai-only">
                <MdAutorenew size={16} /> AI-only gaps — not in your suite ({feat.ai_only.length})
              </h4>
              <ul className="gr-list gr-list--ai-only">
                {feat.ai_only.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}

          {/* Manual-only */}
          {feat.manual_only.length > 0 && (
            <div className="gr-section">
              <h4 className="gr-section-title gr-section-title--manual">
                <MdContentCopy size={16} /> Manual-only — unique depth your AI didn't generate ({feat.manual_only.length})
              </h4>
              <ul className="gr-list gr-list--manual">
                {feat.manual_only.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}

          {/* Redundant */}
          {feat.redundant_pairs.length > 0 && (
            <div className="gr-section">
              <h4 className="gr-section-title gr-section-title--redundant">
                <MdWarning size={16} /> Potentially redundant pairs ({feat.redundant_pairs.length})
              </h4>
              <table className="gr-table">
                <thead>
                  <tr><th>Case A</th><th>Case B</th><th>Similarity</th></tr>
                </thead>
                <tbody>
                  {feat.redundant_pairs.map((r, i) => (
                    <tr key={i}>
                      <td>{r.case_a}</td>
                      <td>{r.case_b}</td>
                      <td><span className="gr-sim-chip gr-sim-chip--warn">{pct(r.similarity * 100)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main GapReport component ──────────────────────────────────────────────────

function GapReport({ report, onRunAgain }) {
  const { summary, features, unmapped_manual_cases, project_name, total_uploaded } = report;

  const handleDownloadFull = () => {
    const rows = [CSV_HEADER];
    features.forEach(feat => featureToRows(feat).forEach(r => rows.push(r)));
    unmapped_manual_cases.forEach(t =>
      rows.push(csvRow('Unmapped', 'Unmapped', t, '', ''))
    );
    downloadCSV(`gap-report-${project_name.replace(/\s+/g, '_')}.csv`, rows);
  };

  const summaryCards = [
    {
      label: 'Exact coverage',
      value: pct(summary.exact_coverage_pct),
      accent: summary.exact_coverage_pct >= 75 ? 'green' : summary.exact_coverage_pct >= 40 ? 'amber' : 'red',
    },
    {
      label: 'Adjusted coverage',
      value: pct(summary.adjusted_coverage_pct),
      accent: summary.adjusted_coverage_pct >= 75 ? 'green' : summary.adjusted_coverage_pct >= 40 ? 'amber' : 'red',
    },
    { label: 'Matched',         value: summary.matched_count,     accent: 'green'  },
    { label: 'Near-misses',     value: summary.near_miss_count,   accent: 'purple' },
    { label: 'AI-only gaps',    value: summary.ai_only_count,     accent: 'red'    },
    { label: 'Manual-only',     value: summary.manual_only_count, accent: 'blue'   },
    { label: 'Redundant pairs', value: summary.redundant_count,   accent: 'amber'  },
    { label: 'Unmapped',        value: summary.unmapped_cases,    accent: 'grey'   },
  ];

  return (
    <div className="gr-root">

      {/* Report header */}
      <div className="gr-report-header">
        <div>
          <h2 className="gr-report-title">
            <MdBarChart size={24} /> Gap Report — {project_name}
          </h2>
          <p className="gr-report-meta">
            {total_uploaded} uploaded &bull; {summary.total_ai_cases} AI cases &bull; {features.length} feature{features.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="gr-header-actions">
          <button className="uc-submit-btn gr-rerun-btn" onClick={onRunAgain}>
            Upload another file
          </button>
          <button className="uc-submit-btn gr-download-full-btn" onClick={handleDownloadFull}>
            <MdDownload size={16} /> Download Report
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="gr-summary-grid">
        {summaryCards.map(({ label, value, accent }) => (
          <div key={label} className={`gr-summary-card gr-summary-card--${accent}`}>
            <span className="gr-summary-value">{value}</span>
            <span className="gr-summary-label">{label}</span>
          </div>
        ))}
      </div>

      {/* Per-feature drill-down */}
      <div className="gr-features">
        <h3 className="gr-features-heading">Feature breakdown</h3>
        {features.map((feat) => (
          <FeatureSection key={feat.feature_name} feat={feat} />
        ))}
      </div>

      {/* Unmapped */}
      {unmapped_manual_cases.length > 0 && (
        <div className="gr-unmapped">
          <h3 className="gr-unmapped-title">
            <MdWarning size={18} /> Unmapped cases ({unmapped_manual_cases.length})
          </h3>
          <p className="gr-unmapped-desc">
            These uploaded test cases could not be confidently assigned to any feature.
            Add a <code>feature</code> column to your file or re-run with manual mapping.
          </p>
          <ul className="gr-list gr-list--unmapped">
            {unmapped_manual_cases.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

export default GapReport;
