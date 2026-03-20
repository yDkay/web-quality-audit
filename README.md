# 🔍 web-quality-audit

A comprehensive website quality audit tool that checks **accessibility**, **SEO**, and **best practices** using real browser automation with both **Cypress** and **Playwright**.

Every check is implemented in both frameworks, running the same assertions against the same demo page, producing a unified HTML report. Built with **TypeScript**, **axe-core**, and a custom CLI.

![CI](https://github.com/YOUR_USERNAME/web-quality-audit/actions/workflows/audit.yml/badge.svg)

---

## What it checks

### Accessibility (WCAG 2.1 AA/AAA)
- Color contrast ratios with exact values and required thresholds
- Missing or non-descriptive image alt text
- Form inputs without associated labels
- Heading hierarchy violations (skipped levels, missing H1)
- Touch target sizes below 44x44px minimum
- Generic link text ("click here", "read more")
- Missing `lang` attribute and document title
- Links opening in new tabs without user warning
- Full axe-core WCAG 2.1 AA automated scan

### SEO
- Meta title and description (presence and length)
- Open Graph and Twitter Card tags
- Canonical URL
- Viewport meta tag
- Heading structure for search engines
- Robots meta directives
- Structured data (JSON-LD) detection
- Image dimensions and lazy loading

### Best Practices
- Broken links and broken images
- CTA visibility above the fold
- Console errors and warnings
- Favicon and Apple touch icon
- Form usability (autocomplete, correct input types)
- Mixed content detection (HTTP on HTTPS)
- `rel="noopener"` on `target="_blank"` links
- Cookie consent mechanism detection
- Responsive screenshots (mobile, tablet, desktop)

---

## Dual-framework architecture

The same 30+ checks are implemented in both Cypress and Playwright. Both save results in the same JSON format, so they produce a single unified HTML report.

| Aspect | Cypress | Playwright |
|---|---|---|
| Test style | Command chaining (`cy.get().then()`) | Async/await (`page.evaluate()`) |
| Waiting | Implicit (built into `cy.get`) | Explicit (`await`) |
| Custom logic | Commands in global namespace | Typed fixtures via `test.extend` |
| axe-core | `cypress-axe` | `@axe-core/playwright` |
| Browser support | Chrome, Electron, Firefox, Edge | Chromium, Firefox, WebKit |
| Config | `cypress.config.ts` | `playwright.config.ts` |

---

## Quick start

```bash
# Clone and install
git clone https://github.com/YOUR_USERNAME/web-quality-audit.git
cd web-quality-audit
npm install
npx playwright install chromium   # only needed for Playwright

# Run against the included demo page
npm run demo &

# Cypress audit
npm run audit -- --url http://localhost:3939

# Playwright audit
npm run audit -- --url http://localhost:3939 --framework playwright

# Run against any production URL
npm run audit -- --url https://your-site.com
npm run audit -- --url https://your-site.com --framework playwright
```

---

## CLI options

```
Usage: web-quality-audit [options]

Options:
  -u, --url <url>              Target URL to audit
  -c, --category <categories>  Categories: accessibility, seo, best-practices
  -f, --framework <framework>  Framework: cypress, playwright (default: "cypress")
  -o, --output <dir>           Output directory (default: "reports")
  --config <path>              Config file path (default: "audit.config.ts")
  --headed                     Run with visible browser
  --browser <browser>          Browser for Cypress (default: "electron")
  -V, --version                Output version
  -h, --help                   Display help
```

---

## Configuration

Create or edit `audit.config.ts` in the project root:

```typescript
import { AuditConfig } from './src/types';

const config: AuditConfig = {
  url: 'https://your-site.com',
  categories: ['accessibility', 'seo', 'best-practices'],
  viewports: [
    { name: 'mobile', width: 375, height: 812 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1280, height: 720 },
  ],
  outputDir: 'reports',
  reportFormat: 'both',
};

export default config;
```

CLI flags always override the config file.

---

## HTML Report

After each audit run, a self-contained HTML report is generated at `reports/audit-report.html`:

- Overall score and per-category scores (0-100)
- Pass/fail/warning counts
- Filter buttons (All, Failed, Passed, Critical, Warning)
- Expandable details per check with element references and help links
- Dark theme, responsive layout

Both Cypress and Playwright results merge into the same report. The report shows which framework produced each result.

---

## CI/CD

The GitHub Actions workflow (`.github/workflows/audit.yml`) runs **6 parallel audit jobs** (3 Cypress + 3 Playwright), merges all results, generates the report, and deploys to GitHub Pages.

```
quality (lint + typecheck)
  ├── cy-accessibility
  ├── cy-seo
  ├── cy-best-practices
  ├── pw-accessibility
  ├── pw-seo
  └── pw-best-practices
       └── report (merge + deploy)
```

Features:
- Parallel jobs per framework and category
- `workflow_dispatch` to audit any URL manually
- Scheduled cron every Monday at 08:00 UTC
- Artifacts retained for 30 days (results) and 90 days (report)
- GitHub Pages deployment on every push to `main`

---

## Project structure

```
web-quality-audit/
├── cypress/
│   ├── e2e/
│   │   ├── accessibility/    # Cypress a11y checks
│   │   ├── seo/              # Cypress SEO checks
│   │   └── best-practices/   # Cypress best practices checks
│   └── support/
│       ├── commands.ts       # Custom Cypress commands
│       └── e2e.ts            # Support entry point
├── playwright/
│   ├── tests/
│   │   ├── accessibility/    # Playwright a11y checks
│   │   ├── seo/              # Playwright SEO checks
│   │   └── best-practices/   # Playwright best practices checks
│   └── support/
│       └── audit-fixture.ts  # Custom Playwright fixture
├── src/
│   ├── cli.ts                # CLI entry point (commander)
│   ├── reporter/
│   │   └── generate.ts       # HTML report generator
│   └── types/
│       └── audit.ts          # Shared TypeScript types
├── demo/
│   └── index.html            # Demo page with 30+ intentional issues
├── .github/workflows/
│   └── audit.yml             # CI/CD pipeline (6 parallel jobs)
├── audit.config.ts           # Default configuration
├── cypress.config.ts         # Cypress configuration
├── playwright.config.ts      # Playwright configuration
├── tsconfig.json
└── package.json
```

---

## npm scripts

| Script | Description |
|---|---|
| `npm run audit` | Run audit via CLI (supports `--framework`, `--url`, etc.) |
| `npm run audit:accessibility` | Audit accessibility only (Cypress) |
| `npm run audit:seo` | Audit SEO only (Cypress) |
| `npm run audit:best-practices` | Audit best practices only (Cypress) |
| `npm run cy:open` | Open Cypress interactive runner |
| `npm run cy:run` | Run all Cypress specs |
| `npm run pw:run` | Run all Playwright specs |
| `npm run pw:run:ui` | Open Playwright UI mode |
| `npm run pw:report` | Open last Playwright HTML report |
| `npm run demo` | Serve demo page on port 3939 |
| `npm run report` | Regenerate HTML report from existing data |
| `npm run typecheck` | Run TypeScript compiler check |

---

## Demo page

The `demo/index.html` page includes 30+ intentional issues across all three categories for testing and development. Run `npm run demo` to serve it locally. Each issue is documented with inline comments.

---

## Roadmap

- [ ] `FRAMEWORK_COMPARISON.md` documenting DX, speed, and capability differences
- [ ] Performance audit category (LCP, FCP, CLS)
- [ ] Security audit category (headers, mixed content, exposed source maps)
- [ ] npm package publishing (`npx web-quality-audit --url ...`)
- [ ] Multi-page crawling (follow sitemap or navigation links)
- [ ] Visual regression diffing between runs
- [ ] Slack/Discord webhook notifications on failures
- [ ] Cross-browser matrix (Firefox, WebKit via Playwright)

---

## License

MIT
