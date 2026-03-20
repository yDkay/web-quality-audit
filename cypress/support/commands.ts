import 'cypress-axe';

// ──────────────────────────────────────────────
// Custom commands for web-quality-audit
// ──────────────────────────────────────────────

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Collect all audit results and save them via task
       */
      saveAuditResult(check: AuditCheckInput): void;

      /**
       * Get computed style property of an element
       */
      getComputedStyle(property: string): Chainable<string>;

      /**
       * Check if an element meets minimum touch target size
       */
      checkTouchTarget(minSize?: number): void;

      /**
       * Capture responsive screenshots at multiple viewports
       */
      captureResponsiveScreenshots(viewports?: ViewportDef[]): void;

      /**
       * Check all links on the page for broken URLs (404s)
       */
      checkBrokenLinks(): Chainable<LinkCheckResult[]>;
    }
  }
}

interface AuditCheckInput {
  id: string;
  name: string;
  category: 'accessibility' | 'seo' | 'best-practices';
  severity: 'critical' | 'warning' | 'info';
  status: 'pass' | 'fail' | 'warning';
  description: string;
  details?: string;
  element?: string;
  expected?: string;
  actual?: string;
  helpUrl?: string;
}

interface ViewportDef {
  name: string;
  width: number;
  height: number;
}

interface LinkCheckResult {
  url: string;
  status: number | 'error';
  element: string;
}

// Store audit results in memory during test run
const auditResults: AuditCheckInput[] = [];

Cypress.Commands.add('saveAuditResult', (check: AuditCheckInput) => {
  auditResults.push(check);

  // Also log to Cypress for visibility
  const icon = check.status === 'pass' ? '✅' : check.status === 'fail' ? '❌' : '⚠️';
  cy.task('log', `${icon} [${check.category}] ${check.name}: ${check.status}`);
});

Cypress.Commands.add(
  'getComputedStyle',
  { prevSubject: 'element' },
  (subject: JQuery<HTMLElement>, property: string) => {
    return cy.wrap(subject).then(($el) => {
      const style = window.getComputedStyle($el[0]);
      return style.getPropertyValue(property);
    });
  }
);

Cypress.Commands.add(
  'checkTouchTarget',
  { prevSubject: 'element' },
  (subject: JQuery<HTMLElement>, minSize = 44) => {
    cy.wrap(subject).then(($el) => {
      const rect = $el[0].getBoundingClientRect();
      const tooSmall = rect.width < minSize || rect.height < minSize;

      cy.saveAuditResult({
        id: `touch-target-${Cypress._.uniqueId()}`,
        name: 'Touch target size',
        category: 'accessibility',
        severity: 'warning',
        status: tooSmall ? 'fail' : 'pass',
        description: `Interactive elements should be at least ${minSize}x${minSize}px`,
        element: $el[0].outerHTML.slice(0, 120),
        expected: `${minSize}x${minSize}px minimum`,
        actual: `${Math.round(rect.width)}x${Math.round(rect.height)}px`,
        helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/target-size.html',
      });
    });
  }
);

Cypress.Commands.add(
  'captureResponsiveScreenshots',
  (
    viewports: ViewportDef[] = [
      { name: 'mobile', width: 375, height: 812 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1280, height: 720 },
    ]
  ) => {
    viewports.forEach((vp) => {
      cy.viewport(vp.width, vp.height);
      // Small wait for layout reflow
      cy.wait(500);
      cy.screenshot(`responsive-${vp.name}-${vp.width}x${vp.height}`, {
        capture: 'fullPage',
      });
    });
  }
);

Cypress.Commands.add('checkBrokenLinks', () => {
  const results: LinkCheckResult[] = [];

  cy.get('a[href]').each(($link) => {
    const href = $link.attr('href') || '';

    // Skip anchors, javascript:, mailto:, tel:, empty, and external URLs
    if (
      href.startsWith('#') ||
      href.startsWith('javascript:') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('http') ||
      href === ''
    ) {
      return;
    }

    const absoluteUrl = `${Cypress.config('baseUrl')}${href}`;

    cy.request({ url: absoluteUrl, failOnStatusCode: false }).then(
      (response) => {
        results.push({
          url: href,
          status: response.status,
          element: ($link[0] as HTMLElement).outerHTML.slice(0, 120),
        });
      }
    );
  });

  return cy.wrap(results);
});

// After all specs complete, save results to disk
after(() => {
  if (auditResults.length > 0) {
    cy.task('saveAuditResults', {
      url: Cypress.config('baseUrl'),
      timestamp: new Date().toISOString(),
      framework: 'cypress',
      checks: auditResults,
    });
  }
});
