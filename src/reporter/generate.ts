import * as fs from 'fs';
import * as path from 'path';
import { AuditCheck, Category, CategorySummary, SEVERITY_WEIGHT } from '../types';

interface RawAuditData {
  url: string;
  timestamp: string;
  framework: string;
  checks: AuditCheck[];
}

function loadResults(outputDir: string): RawAuditData | null {
  const dataDir = path.join(outputDir, 'data');

  if (!fs.existsSync(dataDir)) {
    console.log('No audit data found');
    return null;
  }

  const files = fs.readdirSync(dataDir)
    .filter((f) => f.endsWith('.json'))
    .sort();

  if (files.length === 0) {
    console.log('No audit result files found');
    return null;
  }

  // Merge all result files into a single report.
  // Each spec file (accessibility, seo, best-practices) saves its own JSON,
  // so we combine all checks from every file.
  const allChecks: AuditCheck[] = [];
  let url = '';
  let timestamp = '';
  let framework = '';

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as RawAuditData;

    allChecks.push(...raw.checks);

    // Use metadata from the latest file
    url = raw.url || url;
    timestamp = raw.timestamp || timestamp;
    framework = raw.framework || framework;
  }

  console.log(`Loaded ${files.length} result file(s) with ${allChecks.length} total checks`);

  return {
    url,
    timestamp,
    framework,
    checks: allChecks,
  };
}

function calculateSummary(checks: AuditCheck[], category: Category): CategorySummary {
  const categoryChecks = checks.filter((c) => c.category === category);
  const passed = categoryChecks.filter((c) => c.status === 'pass').length;
  const failed = categoryChecks.filter((c) => c.status === 'fail').length;
  const warnings = categoryChecks.filter((c) => c.status === 'warning').length;
  const total = categoryChecks.length;

  // Score: each check contributes its severity weight to the max possible score.
  // Failures deduct the full weight, warnings deduct half.
  let maxScore = 0;
  let deductions = 0;

  categoryChecks.forEach((check) => {
    maxScore += SEVERITY_WEIGHT[check.severity];

    if (check.status === 'fail') {
      deductions += SEVERITY_WEIGHT[check.severity];
    } else if (check.status === 'warning') {
      deductions += SEVERITY_WEIGHT[check.severity] * 0.5;
    }
  });

  const score = maxScore > 0 ? Math.max(0, Math.round(((maxScore - deductions) / maxScore) * 100)) : 100;

  return { category, total, passed, failed, warnings, score };
}

function getScoreColor(score: number): string {
  if (score >= 90) return '#22c55e';
  if (score >= 70) return '#eab308';
  if (score >= 50) return '#f97316';
  return '#ef4444';
}

function getSeverityBadge(severity: string): string {
  const colors: Record<string, string> = {
    critical: '#ef4444',
    warning: '#f97316',
    info: '#3b82f6',
  };
  return `<span style="
    background: ${colors[severity] || '#6b7280'};
    color: white;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
  ">${severity}</span>`;
}

function getStatusIcon(status: string): string {
  if (status === 'pass') return '✅';
  if (status === 'fail') return '❌';
  return '⚠️';
}

function generateHtml(data: RawAuditData): string {
  const categories: Category[] = ['accessibility', 'seo', 'best-practices'];
  const summaries = categories.map((cat) => calculateSummary(data.checks, cat));
  const overallScore = Math.round(
    summaries.reduce((acc, s) => acc + s.score, 0) / summaries.length
  );

  const categoryLabels: Record<Category, string> = {
    accessibility: 'Accessibility',
    seo: 'SEO',
    'best-practices': 'Best Practices',
  };

  const failedChecks = data.checks.filter((c) => c.status === 'fail');
  const criticalCount = failedChecks.filter((c) => c.severity === 'critical').length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Web Quality Audit Report - ${escapeHtml(data.url)}</title>
  <style>
    :root {
      --bg: #0f172a;
      --surface: #1e293b;
      --surface-hover: #334155;
      --border: #334155;
      --text: #e2e8f0;
      --text-muted: #94a3b8;
      --accent: #3b82f6;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
    }

    .container {
      max-width: 1100px;
      margin: 0 auto;
      padding: 40px 24px;
    }

    header {
      text-align: center;
      margin-bottom: 48px;
    }

    header h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    header .url {
      color: var(--accent);
      font-size: 16px;
      word-break: break-all;
    }

    header .meta {
      color: var(--text-muted);
      font-size: 13px;
      margin-top: 8px;
    }

    .score-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 40px;
    }

    .score-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      text-align: center;
    }

    .score-card .score {
      font-size: 48px;
      font-weight: 800;
      line-height: 1;
    }

    .score-card .label {
      font-size: 14px;
      color: var(--text-muted);
      margin-top: 8px;
    }

    .score-card .stats {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 12px;
    }

    .summary-bar {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 32px;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }

    .summary-stat {
      text-align: center;
    }

    .summary-stat .value {
      font-size: 24px;
      font-weight: 700;
    }

    .summary-stat .label {
      font-size: 12px;
      color: var(--text-muted);
    }

    .category-section {
      margin-bottom: 40px;
    }

    .category-header {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid var(--border);
    }

    .check-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .check-item {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
    }

    .check-item.fail {
      border-left: 3px solid #ef4444;
    }

    .check-item.pass {
      border-left: 3px solid #22c55e;
    }

    .check-item.warning {
      border-left: 3px solid #f97316;
    }

    .check-header {
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      user-select: none;
    }

    .check-header:hover {
      background: var(--surface-hover);
    }

    .check-header .name {
      font-weight: 600;
      font-size: 14px;
      flex: 1;
    }

    .check-details {
      display: none;
      padding: 0 16px 16px;
      font-size: 13px;
      color: var(--text-muted);
    }

    .check-details.open {
      display: block;
    }

    .check-details table {
      width: 100%;
      border-collapse: collapse;
    }

    .check-details td {
      padding: 4px 0;
      vertical-align: top;
    }

    .check-details td:first-child {
      width: 80px;
      font-weight: 600;
      color: var(--text);
    }

    .check-details code {
      background: var(--bg);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
      word-break: break-all;
    }

    .check-details a {
      color: var(--accent);
      text-decoration: none;
    }

    .check-details a:hover {
      text-decoration: underline;
    }

    .filter-bar {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .filter-btn {
      padding: 6px 14px;
      border-radius: 20px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      font-size: 13px;
      cursor: pointer;
    }

    .filter-btn:hover {
      background: var(--surface-hover);
    }

    .filter-btn.active {
      background: var(--accent);
      border-color: var(--accent);
      color: white;
    }

    footer {
      text-align: center;
      padding: 40px 0 20px;
      color: var(--text-muted);
      font-size: 12px;
    }

    footer a {
      color: var(--accent);
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🔍 Web Quality Audit Report</h1>
      <div class="url">${escapeHtml(data.url)}</div>
      <div class="meta">
        Generated on ${new Date(data.timestamp).toLocaleString()} | Framework: ${data.framework} | ${data.checks.length} checks run
      </div>
    </header>

    <div class="score-grid">
      <div class="score-card">
        <div class="score" style="color: ${getScoreColor(overallScore)}">${overallScore}</div>
        <div class="label">Overall Score</div>
        <div class="stats">${criticalCount} critical issue${criticalCount !== 1 ? 's' : ''}</div>
      </div>
      ${summaries.map((s) => `
      <div class="score-card">
        <div class="score" style="color: ${getScoreColor(s.score)}">${s.score}</div>
        <div class="label">${categoryLabels[s.category]}</div>
        <div class="stats">${s.passed} pass | ${s.failed} fail | ${s.warnings} warn</div>
      </div>
      `).join('')}
    </div>

    <div class="summary-bar">
      <div class="summary-stat">
        <div class="value">${data.checks.length}</div>
        <div class="label">Total Checks</div>
      </div>
      <div class="summary-stat">
        <div class="value" style="color: #22c55e">${data.checks.filter((c) => c.status === 'pass').length}</div>
        <div class="label">Passed</div>
      </div>
      <div class="summary-stat">
        <div class="value" style="color: #ef4444">${failedChecks.length}</div>
        <div class="label">Failed</div>
      </div>
      <div class="summary-stat">
        <div class="value" style="color: #ef4444">${criticalCount}</div>
        <div class="label">Critical</div>
      </div>
    </div>

    <div class="filter-bar">
      <button class="filter-btn active" onclick="filterChecks('all', this)">All</button>
      <button class="filter-btn" onclick="filterChecks('fail', this)">❌ Failed</button>
      <button class="filter-btn" onclick="filterChecks('pass', this)">✅ Passed</button>
      <button class="filter-btn" onclick="filterChecks('critical', this)">🔴 Critical</button>
      <button class="filter-btn" onclick="filterChecks('warning', this)">🟡 Warning</button>
    </div>

    ${categories.map((cat) => {
      const catChecks = data.checks.filter((c) => c.category === cat);
      if (catChecks.length === 0) return '';

      // Sort: failed critical first, then failed warnings, then passed
      catChecks.sort((a, b) => {
        const statusOrder = { fail: 0, warning: 1, pass: 2 };
        const sevOrder = { critical: 0, warning: 1, info: 2 };
        const statusDiff = (statusOrder[a.status] ?? 2) - (statusOrder[b.status] ?? 2);
        if (statusDiff !== 0) return statusDiff;
        return (sevOrder[a.severity] ?? 2) - (sevOrder[b.severity] ?? 2);
      });

      return `
    <div class="category-section">
      <h2 class="category-header">${categoryLabels[cat]}</h2>
      <div class="check-list">
        ${catChecks.map((check, i) => `
        <div class="check-item ${check.status}" data-status="${check.status}" data-severity="${check.severity}">
          <div class="check-header" onclick="toggleDetails('${cat}-${i}')">
            <span>${getStatusIcon(check.status)}</span>
            <span class="name">${escapeHtml(check.name)}</span>
            ${getSeverityBadge(check.severity)}
          </div>
          <div class="check-details" id="${cat}-${i}">
            <table>
              <tr><td>Description</td><td>${escapeHtml(check.description)}</td></tr>
              ${check.expected ? `<tr><td>Expected</td><td><code>${escapeHtml(check.expected)}</code></td></tr>` : ''}
              ${check.actual ? `<tr><td>Actual</td><td><code>${escapeHtml(check.actual)}</code></td></tr>` : ''}
              ${check.element ? `<tr><td>Element</td><td><code>${escapeHtml(check.element)}</code></td></tr>` : ''}
              ${check.details ? `<tr><td>Details</td><td>${escapeHtml(check.details)}</td></tr>` : ''}
              ${check.helpUrl ? `<tr><td>Help</td><td><a href="${escapeHtml(check.helpUrl)}" target="_blank" rel="noopener">${escapeHtml(check.helpUrl)}</a></td></tr>` : ''}
            </table>
          </div>
        </div>
        `).join('')}
      </div>
    </div>`;
    }).join('')}

    <footer>
      Generated by <a href="https://github.com/YOUR_USERNAME/web-quality-audit">web-quality-audit</a>
    </footer>
  </div>

  <script>
    function toggleDetails(id) {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('open');
    }

    function filterChecks(filter, btn) {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      document.querySelectorAll('.check-item').forEach(item => {
        const status = item.dataset.status;
        const severity = item.dataset.severity;

        if (filter === 'all') {
          item.style.display = '';
        } else if (filter === 'critical' || filter === 'warning') {
          item.style.display = severity === filter ? '' : 'none';
        } else {
          item.style.display = status === filter ? '' : 'none';
        }
      });
    }
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ──────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────

const outputDir = process.env.AUDIT_OUTPUT_DIR || path.join(__dirname, '..', '..', 'reports');
const data = loadResults(outputDir);

if (data) {
  const html = generateHtml(data);
  const reportPath = path.join(outputDir, 'audit-report.html');
  fs.writeFileSync(reportPath, html);
  console.log(`\n📊 Report generated: ${reportPath}\n`);
} else {
  console.log('No data to generate report from.');
  process.exit(1);
}
