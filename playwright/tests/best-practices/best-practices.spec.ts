import { test, expect, createAuditCollector } from '../../support/audit-fixture';

const audit = createAuditCollector();

test.afterAll(async ({ baseURL }) => {
  audit.flush(baseURL || 'unknown');
});

test.describe('Best Practices Audit', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.goto(baseURL || '/');
  });

  // ──────────────────────────────────────────────
  // BROKEN LINKS AND IMAGES
  // ──────────────────────────────────────────────

  test('should not have broken links', async ({ page, request, baseURL }) => {
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href]')).map((a) => ({
        href: a.getAttribute('href') || '',
        html: (a as HTMLElement).outerHTML.slice(0, 120),
      }));
    });

    for (const link of links) {
      const { href } = link;

      // Skip anchors, javascript:, mailto:, tel:, empty, external
      if (
        href.startsWith('#') ||
        href.startsWith('javascript:') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('http') ||
        href === ''
      ) {
        continue;
      }

      // Playwright's request fixture respects baseURL from config,
      // so relative paths like '/about' resolve automatically.
      const url = href.startsWith('/') ? `${baseURL}${href}` : `${baseURL}/${href}`;

      try {
        const response = await request.get(url);
        const isBroken = response.status() >= 400;

        audit.save({
          id: `bp-broken-link-${Math.random().toString(36).slice(2, 6)}`,
          name: 'Broken link',
          category: 'best-practices',
          severity: isBroken ? 'critical' : 'info',
          status: isBroken ? 'fail' : 'pass',
          description: `Internal link returns HTTP ${response.status()}`,
          element: link.html,
          expected: 'HTTP 2xx or 3xx',
          actual: `HTTP ${response.status()} for ${href}`,
        });
      } catch {
        audit.save({
          id: `bp-broken-link-${Math.random().toString(36).slice(2, 6)}`,
          name: 'Broken link',
          category: 'best-practices',
          severity: 'critical',
          status: 'fail',
          description: `Internal link failed to load: ${href}`,
          element: link.html,
          expected: 'HTTP 2xx or 3xx',
          actual: `Network error for ${href}`,
        });
      }
    }
  });

  test('should not have broken images', async ({ page }) => {
    const images = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img[src]')).map((img) => {
        const imgEl = img as HTMLImageElement;
        return {
          src: imgEl.getAttribute('src') || '',
          isBroken: imgEl.complete && imgEl.naturalWidth === 0,
          html: imgEl.outerHTML.slice(0, 120),
        };
      });
    });

    for (const img of images) {
      if (!img.src || img.src.startsWith('data:')) continue;

      audit.save({
        id: `bp-broken-img-${Math.random().toString(36).slice(2, 6)}`,
        name: 'Broken image',
        category: 'best-practices',
        severity: img.isBroken ? 'critical' : 'info',
        status: img.isBroken ? 'fail' : 'pass',
        description: img.isBroken
          ? `Image failed to load: ${img.src}`
          : `Image loaded successfully: ${img.src}`,
        element: img.html,
        expected: 'Image loads successfully',
        actual: img.isBroken ? `Broken (src: ${img.src})` : 'Loaded',
      });
    }
  });

  // ──────────────────────────────────────────────
  // CONSOLE ERRORS
  // ──────────────────────────────────────────────

  test('should not have console errors', async ({ page, baseURL }) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Playwright: listen for console events BEFORE navigating
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text().slice(0, 100));
      if (msg.type() === 'warning') warnings.push(msg.text().slice(0, 100));
    });

    // Also catch uncaught page errors
    page.on('pageerror', (err) => {
      errors.push(err.message.slice(0, 100));
    });

    await page.goto(baseURL || '/');
    await page.waitForTimeout(2000);

    audit.save({
      id: 'bp-console-errors',
      name: 'Console errors',
      category: 'best-practices',
      severity: errors.length > 0 ? 'critical' : 'info',
      status: errors.length > 0 ? 'fail' : 'pass',
      description: 'Page should not produce JavaScript console errors',
      expected: '0 console errors',
      actual: `${errors.length} error(s)`,
      details: errors.length > 0 ? errors.slice(0, 5).join('\n') : undefined,
    });

    audit.save({
      id: 'bp-console-warnings',
      name: 'Console warnings',
      category: 'best-practices',
      severity: 'info',
      status: warnings.length > 0 ? 'warning' : 'pass',
      description: 'Page should minimize console warnings',
      expected: '0 console warnings',
      actual: `${warnings.length} warning(s)`,
    });
  });

  // ──────────────────────────────────────────────
  // FAVICON
  // ──────────────────────────────────────────────

  test('should have a favicon', async ({ page }) => {
    const { favicon, appleIcon } = await page.evaluate(() => ({
      favicon:
        !!document.querySelector('link[rel="icon"]') ||
        !!document.querySelector('link[rel="shortcut icon"]'),
      appleIcon: !!document.querySelector('link[rel="apple-touch-icon"]'),
    }));

    audit.save({
      id: 'bp-favicon',
      name: 'Favicon',
      category: 'best-practices',
      severity: 'warning',
      status: favicon ? 'pass' : 'fail',
      description: 'Page should have a favicon for browser tabs and bookmarks',
      expected: '<link rel="icon" href="...">',
      actual: favicon ? 'Favicon found' : 'No favicon link tag',
    });

    audit.save({
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

  // ──────────────────────────────────────────────
  // FORM BEST PRACTICES
  // ──────────────────────────────────────────────

  test('should have proper form attributes', async ({ page }) => {
    const forms = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('form')).map((form, i) => ({
        index: i,
        action: form.getAttribute('action'),
        html: form.outerHTML.slice(0, 100),
      }));
    });

    for (const form of forms) {
      audit.save({
        id: `bp-form-action-${form.index}`,
        name: 'Form has action attribute',
        category: 'best-practices',
        severity: 'warning',
        status: form.action ? 'pass' : 'fail',
        description: 'Forms should have an explicit action attribute',
        element: form.html,
        expected: 'action="..."',
        actual: form.action ? `action="${form.action}"` : 'No action attribute',
      });
    }

    // Autocomplete and input type checks
    const inputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input')).map((input) => ({
        type: input.getAttribute('type') || 'text',
        placeholder: (input.getAttribute('placeholder') || '').toLowerCase(),
        name: (input.getAttribute('name') || '').toLowerCase(),
        autocomplete: input.getAttribute('autocomplete'),
        html: input.outerHTML.slice(0, 120),
      }));
    });

    const autocompleteCandidates = ['name', 'email', 'phone', 'address', 'city', 'zip', 'postal'];

    for (const input of inputs) {
      // Autocomplete check
      const isCandidate = autocompleteCandidates.some(
        (kw) => input.placeholder.includes(kw) || input.name.includes(kw)
      );

      if (isCandidate && input.type !== 'hidden') {
        audit.save({
          id: `bp-autocomplete-${Math.random().toString(36).slice(2, 6)}`,
          name: 'Input autocomplete attribute',
          category: 'best-practices',
          severity: 'info',
          status: input.autocomplete ? 'pass' : 'fail',
          description: 'Inputs for personal data should have autocomplete for better UX',
          element: input.html,
          expected: 'autocomplete="name|email|tel|..."',
          actual: input.autocomplete ? `autocomplete="${input.autocomplete}"` : 'Missing autocomplete',
          helpUrl: 'https://web.dev/learn/forms/auto/',
        });
      }

      // Email type check
      const looksLikeEmail = input.placeholder.includes('email') || input.name.includes('email');

      if (looksLikeEmail && input.type !== 'email' && input.type !== 'hidden') {
        audit.save({
          id: `bp-input-type-email-${Math.random().toString(36).slice(2, 6)}`,
          name: 'Email input uses correct type',
          category: 'best-practices',
          severity: 'warning',
          status: 'fail',
          description: 'Email fields should use type="email" for mobile keyboards and validation',
          element: input.html,
          expected: 'type="email"',
          actual: `type="${input.type}"`,
          helpUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/email',
        });
      }
    }
  });

  // ──────────────────────────────────────────────
  // CTA ABOVE THE FOLD
  // ──────────────────────────────────────────────

  test('should have a clear CTA above the fold', async ({ page }) => {
    const viewportHeight = page.viewportSize()?.height || 720;

    const ctaAboveFold = await page.evaluate((vpHeight) => {
      const ctaKeywords = ['sign up', 'get started', 'try', 'buy', 'subscribe', 'start', 'join', 'register', 'contact', 'demo', 'free'];
      const elements = Array.from(document.querySelectorAll('a, button, [role="button"]'));

      for (const el of elements) {
        const rect = el.getBoundingClientRect();
        const text = (el.textContent || '').toLowerCase().trim();
        const isCta = ctaKeywords.some((kw) => text.includes(kw));
        if (isCta && rect.top < vpHeight) return true;
      }
      return false;
    }, viewportHeight);

    audit.save({
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

  // ──────────────────────────────────────────────
  // RESPONSIVE SCREENSHOTS
  // ──────────────────────────────────────────────

  test('should capture responsive screenshots for visual review', async ({ helpers }) => {
    await helpers.captureResponsiveScreenshots();

    audit.save({
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

  test('should check for cookie consent mechanism', async ({ page }) => {
    const hasCookieBanner = await page.evaluate(() => {
      const selectors = [
        '[class*="cookie"]', '[id*="cookie"]',
        '[class*="consent"]', '[id*="consent"]',
        '[class*="gdpr"]', '[id*="gdpr"]',
        '[aria-label*="cookie"]',
      ];
      return selectors.some((sel) => document.querySelector(sel) !== null);
    });

    audit.save({
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

  // ──────────────────────────────────────────────
  // HTTPS AND MIXED CONTENT
  // ──────────────────────────────────────────────

  test('should check for mixed content issues', async ({ page }) => {
    const url = page.url();
    const isHttps = url.startsWith('https');

    if (!isHttps) {
      audit.save({
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

    const httpResources = await page.evaluate(() => {
      const els = document.querySelectorAll('img[src^="http:"], script[src^="http:"], link[href^="http:"]');
      return Array.from(els).map((el) => (el as HTMLElement).getAttribute('src') || (el as HTMLElement).getAttribute('href') || '');
    });

    audit.save({
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

  // ──────────────────────────────────────────────
  // TARGET BLANK SECURITY
  // ──────────────────────────────────────────────

  test('should have rel="noopener" on target="_blank" links', async ({ page }) => {
    const blankLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[target="_blank"]')).map((a) => ({
        rel: (a.getAttribute('rel') || '').toLowerCase(),
        html: (a as HTMLElement).outerHTML.slice(0, 120),
      }));
    });

    for (const link of blankLinks) {
      const hasNoopener = link.rel.includes('noopener');

      audit.save({
        id: `bp-noopener-${Math.random().toString(36).slice(2, 6)}`,
        name: 'Rel noopener on external links',
        category: 'best-practices',
        severity: 'warning',
        status: hasNoopener ? 'pass' : 'fail',
        description: 'Links with target="_blank" should have rel="noopener" for security',
        element: link.html,
        expected: 'rel="noopener noreferrer"',
        actual: link.rel ? `rel="${link.rel}"` : 'No rel attribute',
        helpUrl: 'https://web.dev/external-anchors-use-rel-noopener/',
      });
    }
  });
});
