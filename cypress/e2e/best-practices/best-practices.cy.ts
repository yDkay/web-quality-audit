describe('Best Practices Audit', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  // ──────────────────────────────────────────────
  // BROKEN LINKS AND IMAGES
  // ──────────────────────────────────────────────

  it('should not have broken links', () => {
    cy.get('a[href]').each(($link) => {
      const href = $link.attr('href') || '';
      const html = $link[0].outerHTML.slice(0, 120);

      // Skip anchors, javascript:, mailto:, tel:, empty
      if (
        href.startsWith('#') ||
        href.startsWith('javascript:') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href === ''
      ) {
        return;
      }

      // Skip external URLs: cy.request() crashes on DNS failures,
      // and external availability is outside the site owner's control.
      if (href.startsWith('http')) {
        return;
      }

      const absoluteUrl = `${Cypress.config('baseUrl')}${href}`;

      cy.request({ url: absoluteUrl, failOnStatusCode: false }).then(
        (response) => {
          const isBroken = response.status >= 400;

          cy.saveAuditResult({
            id: `bp-broken-link-${Cypress._.uniqueId()}`,
            name: 'Broken link',
            category: 'best-practices',
            severity: isBroken ? 'critical' : 'info',
            status: isBroken ? 'fail' : 'pass',
            description: `Internal link returns HTTP ${response.status}`,
            element: html,
            expected: 'HTTP 2xx or 3xx',
            actual: `HTTP ${response.status} for ${href}`,
          });
        }
      );
    });
  });

  it('should not have broken images', () => {
    cy.get('img[src]').each(($img) => {
      const src = $img.attr('src') || '';
      const html = $img[0].outerHTML.slice(0, 120);

      if (!src || src.startsWith('data:')) return;

      // Use the DOM's naturalWidth to detect broken images instead of HTTP requests.
      // This handles DNS failures, timeouts, and any other network-level issues gracefully.
      const img = $img[0] as HTMLImageElement;
      const isBroken = img.complete && img.naturalWidth === 0;

      cy.saveAuditResult({
        id: `bp-broken-img-${Cypress._.uniqueId()}`,
        name: 'Broken image',
        category: 'best-practices',
        severity: isBroken ? 'critical' : 'info',
        status: isBroken ? 'fail' : 'pass',
        description: isBroken
          ? `Image failed to load: ${src}`
          : `Image loaded successfully: ${src}`,
        element: html,
        expected: 'Image loads successfully',
        actual: isBroken ? `Broken (src: ${src})` : 'Loaded',
      });
    });
  });

  // ──────────────────────────────────────────────
  // CONSOLE ERRORS
  // ──────────────────────────────────────────────

  it('should not have console errors', () => {
    // Spy on console DURING page load by using cy.visit with onBeforeLoad.
    // Note: beforeEach already visited '/', but we need a fresh visit
    // with stubs attached before the page scripts execute.
    cy.visit('/', {
      onBeforeLoad(win) {
        cy.stub(win.console, 'error').as('consoleErrors');
        cy.stub(win.console, 'warn').as('consoleWarns');
      },
    });

    // Wait for any async errors to fire
    cy.wait(2000);

    cy.get('@consoleErrors').then((stub: any) => {
      const errorCount = stub.callCount || 0;
      const errors = stub.args?.map((args: unknown[]) => String(args[0])).slice(0, 5) || [];

      cy.saveAuditResult({
        id: 'bp-console-errors',
        name: 'Console errors',
        category: 'best-practices',
        severity: errorCount > 0 ? 'critical' : 'info',
        status: errorCount > 0 ? 'fail' : 'pass',
        description: 'Page should not produce JavaScript console errors',
        expected: '0 console errors',
        actual: `${errorCount} error(s)`,
        details: errors.length > 0
          ? errors.map((e: string) => e.slice(0, 100)).join('\n')
          : undefined,
      });
    });

    cy.get('@consoleWarns').then((stub: any) => {
      const warnCount = stub.callCount || 0;

      cy.saveAuditResult({
        id: 'bp-console-warnings',
        name: 'Console warnings',
        category: 'best-practices',
        severity: 'info',
        status: warnCount > 0 ? 'warning' : 'pass',
        description: 'Page should minimize console warnings',
        expected: '0 console warnings',
        actual: `${warnCount} warning(s)`,
      });
    });
  });

  // ──────────────────────────────────────────────
  // FAVICON
  // ──────────────────────────────────────────────

  it('should have a favicon', () => {
    cy.get('head').then(($head) => {
      const favicon =
        $head.find('link[rel="icon"]').length > 0 ||
        $head.find('link[rel="shortcut icon"]').length > 0;

      cy.saveAuditResult({
        id: 'bp-favicon',
        name: 'Favicon',
        category: 'best-practices',
        severity: 'warning',
        status: favicon ? 'pass' : 'fail',
        description: 'Page should have a favicon for browser tabs and bookmarks',
        expected: '<link rel="icon" href="...">',
        actual: favicon ? 'Favicon found' : 'No favicon link tag',
      });
    });

    // Check Apple touch icon
    cy.get('head').then(($head) => {
      const appleIcon = $head.find('link[rel="apple-touch-icon"]').length > 0;

      cy.saveAuditResult({
        id: 'bp-apple-touch-icon',
        name: 'Apple touch icon',
        category: 'best-practices',
        severity: 'info',
        status: appleIcon ? 'pass' : 'fail',
        description: 'Page should have an Apple touch icon for iOS home screen',
        expected: '<link rel="apple-touch-icon" href="...">',
        actual: appleIcon ? 'Apple touch icon found' : 'Missing',
      });
    });
  });

  // ──────────────────────────────────────────────
  // FORM BEST PRACTICES
  // ──────────────────────────────────────────────

  it('should have proper form attributes', () => {
    cy.get('form').each(($form, index) => {
      const action = $form.attr('action');
      const html = $form[0].outerHTML.slice(0, 100);

      cy.saveAuditResult({
        id: `bp-form-action-${index}`,
        name: 'Form has action attribute',
        category: 'best-practices',
        severity: 'warning',
        status: action ? 'pass' : 'fail',
        description: 'Forms should have an explicit action attribute',
        element: html,
        expected: 'action="..."',
        actual: action ? `action="${action}"` : 'No action attribute',
      });
    });

    // Check autocomplete on common input types
    cy.get('input').each(($input) => {
      const type = $input.attr('type') || 'text';
      const placeholder = ($input.attr('placeholder') || '').toLowerCase();
      const name = ($input.attr('name') || '').toLowerCase();
      const autocomplete = $input.attr('autocomplete');
      const html = $input[0].outerHTML.slice(0, 120);

      // Only check inputs that would benefit from autocomplete
      const autocompleteCandidates = ['name', 'email', 'phone', 'address', 'city', 'zip', 'postal'];
      const isCandidate = autocompleteCandidates.some(
        (keyword) => placeholder.includes(keyword) || name.includes(keyword)
      );

      if (isCandidate && type !== 'hidden') {
        cy.saveAuditResult({
          id: `bp-autocomplete-${Cypress._.uniqueId()}`,
          name: 'Input autocomplete attribute',
          category: 'best-practices',
          severity: 'info',
          status: autocomplete ? 'pass' : 'fail',
          description: 'Inputs for personal data should have autocomplete for better UX',
          element: html,
          expected: 'autocomplete="name|email|tel|..."',
          actual: autocomplete ? `autocomplete="${autocomplete}"` : 'Missing autocomplete',
          helpUrl: 'https://web.dev/learn/forms/auto/',
        });
      }
    });

    // Check email inputs use correct type
    cy.get('input').each(($input) => {
      const type = $input.attr('type') || 'text';
      const placeholder = ($input.attr('placeholder') || '').toLowerCase();
      const name = ($input.attr('name') || '').toLowerCase();
      const html = $input[0].outerHTML.slice(0, 120);

      const looksLikeEmail =
        placeholder.includes('email') || name.includes('email');

      if (looksLikeEmail && type !== 'email' && type !== 'hidden') {
        cy.saveAuditResult({
          id: `bp-input-type-email-${Cypress._.uniqueId()}`,
          name: 'Email input uses correct type',
          category: 'best-practices',
          severity: 'warning',
          status: 'fail',
          description: 'Email fields should use type="email" for mobile keyboards and validation',
          element: html,
          expected: 'type="email"',
          actual: `type="${type}"`,
          helpUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/email',
        });
      }
    });
  });

  // ──────────────────────────────────────────────
  // CTA ABOVE THE FOLD
  // ──────────────────────────────────────────────

  it('should have a clear CTA above the fold', () => {
    const viewportHeight = Cypress.config('viewportHeight');

    cy.get('a, button, [role="button"]').then(($elements) => {
      const ctaKeywords = ['sign up', 'get started', 'try', 'buy', 'subscribe', 'start', 'join', 'register', 'contact', 'demo', 'free'];
      let ctaAboveFold = false;

      $elements.each((_, el) => {
        const rect = el.getBoundingClientRect();
        const text = (el.textContent || '').toLowerCase().trim();
        const isCta = ctaKeywords.some((keyword) => text.includes(keyword));
        const isAboveFold = rect.top < viewportHeight;

        if (isCta && isAboveFold) {
          ctaAboveFold = true;
        }
      });

      cy.saveAuditResult({
        id: 'bp-cta-above-fold',
        name: 'CTA above the fold',
        category: 'best-practices',
        severity: 'warning',
        status: ctaAboveFold ? 'pass' : 'fail',
        description: 'Landing pages should have a clear call-to-action visible without scrolling',
        expected: 'At least one CTA button/link above the fold',
        actual: ctaAboveFold ? 'CTA found above fold' : 'No CTA detected above the fold',
      });
    });
  });

  // ──────────────────────────────────────────────
  // RESPONSIVE SCREENSHOTS
  // ──────────────────────────────────────────────

  it('should capture responsive screenshots for visual review', () => {
    cy.captureResponsiveScreenshots();

    cy.saveAuditResult({
      id: 'bp-responsive-screenshots',
      name: 'Responsive screenshots captured',
      category: 'best-practices',
      severity: 'info',
      status: 'pass',
      description: 'Screenshots captured at mobile (375px), tablet (768px), and desktop (1280px) for manual review',
    });
  });

  // ──────────────────────────────────────────────
  // COOKIE CONSENT
  // ──────────────────────────────────────────────

  it('should check for cookie consent mechanism', () => {
    const cookieSelectors = [
      '[class*="cookie"]',
      '[id*="cookie"]',
      '[class*="consent"]',
      '[id*="consent"]',
      '[class*="gdpr"]',
      '[id*="gdpr"]',
      '[aria-label*="cookie"]',
    ];

    cy.get('body').then(($body) => {
      const hasCookieBanner = cookieSelectors.some(
        (selector) => $body.find(selector).length > 0
      );

      cy.saveAuditResult({
        id: 'bp-cookie-consent',
        name: 'Cookie consent mechanism',
        category: 'best-practices',
        severity: 'info',
        status: hasCookieBanner ? 'pass' : 'warning',
        description: 'Sites using cookies should have a consent mechanism (GDPR/CCPA)',
        expected: 'Cookie consent banner or mechanism',
        actual: hasCookieBanner ? 'Cookie consent element detected' : 'No cookie consent detected',
      });
    });
  });

  // ──────────────────────────────────────────────
  // HTTPS AND MIXED CONTENT
  // ──────────────────────────────────────────────

  it('should check for mixed content issues', () => {
    cy.url().then((url) => {
      const isHttps = url.startsWith('https');

      if (!isHttps) {
        cy.saveAuditResult({
          id: 'bp-https',
          name: 'HTTPS',
          category: 'best-practices',
          severity: 'info',
          status: 'warning',
          description: 'Site is not served over HTTPS (may be expected for localhost)',
          expected: 'HTTPS',
          actual: 'HTTP',
        });
        return;
      }

      // Check for HTTP resources on HTTPS page
      const httpResources: string[] = [];

      cy.get('img[src^="http:"], script[src^="http:"], link[href^="http:"]').each(($el) => {
        const src = $el.attr('src') || $el.attr('href') || '';
        httpResources.push(src);
      }).then(() => {
        cy.saveAuditResult({
          id: 'bp-mixed-content',
          name: 'Mixed content',
          category: 'best-practices',
          severity: httpResources.length > 0 ? 'critical' : 'info',
          status: httpResources.length > 0 ? 'fail' : 'pass',
          description: 'HTTPS pages should not load HTTP resources',
          expected: 'All resources loaded over HTTPS',
          actual: httpResources.length > 0
            ? `${httpResources.length} HTTP resource(s): ${httpResources.slice(0, 3).join(', ')}`
            : 'No mixed content',
        });
      });
    });
  });

  // ──────────────────────────────────────────────
  // TARGET BLANK SECURITY
  // ──────────────────────────────────────────────

  it('should have rel="noopener" on target="_blank" links', () => {
    cy.get('a[target="_blank"]').each(($link) => {
      const rel = ($link.attr('rel') || '').toLowerCase();
      const hasNoopener = rel.includes('noopener');
      const html = $link[0].outerHTML.slice(0, 120);

      cy.saveAuditResult({
        id: `bp-noopener-${Cypress._.uniqueId()}`,
        name: 'Rel noopener on external links',
        category: 'best-practices',
        severity: 'warning',
        status: hasNoopener ? 'pass' : 'fail',
        description: 'Links with target="_blank" should have rel="noopener" for security',
        element: html,
        expected: 'rel="noopener noreferrer"',
        actual: rel ? `rel="${rel}"` : 'No rel attribute',
        helpUrl: 'https://web.dev/external-anchors-use-rel-noopener/',
      });
    });
  });
});
