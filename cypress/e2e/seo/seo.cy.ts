describe('SEO Audit', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  // ──────────────────────────────────────────────
  // META TAGS
  // ──────────────────────────────────────────────

  it('should have a proper meta title', () => {
    cy.title().then((title) => {
      const exists = !!title && title.length > 0;
      const goodLength = title.length >= 30 && title.length <= 60;

      cy.saveAuditResult({
        id: 'seo-title-exists',
        name: 'Meta title exists',
        category: 'seo',
        severity: 'critical',
        status: exists ? 'pass' : 'fail',
        description: 'Page must have a <title> tag',
        expected: 'Non-empty title tag',
        actual: exists ? `"${title}"` : 'Missing or empty',
        helpUrl: 'https://developers.google.com/search/docs/appearance/title-link',
      });

      if (exists) {
        cy.saveAuditResult({
          id: 'seo-title-length',
          name: 'Meta title length',
          category: 'seo',
          severity: 'warning',
          status: goodLength ? 'pass' : 'fail',
          description: 'Title should be between 30-60 characters for optimal display in search results',
          expected: '30-60 characters',
          actual: `${title.length} characters: "${title}"`,
          helpUrl: 'https://developers.google.com/search/docs/appearance/title-link',
        });
      }
    });
  });

  it('should have a proper meta description', () => {
    cy.get('head').then(($head) => {
      const metaDesc = $head.find('meta[name="description"]');
      const content = metaDesc.attr('content') || '';
      const exists = metaDesc.length > 0 && content.length > 0;
      const goodLength = content.length >= 120 && content.length <= 160;

      cy.saveAuditResult({
        id: 'seo-description-exists',
        name: 'Meta description exists',
        category: 'seo',
        severity: 'critical',
        status: exists ? 'pass' : 'fail',
        description: 'Page must have a meta description for search engine snippets',
        expected: 'Non-empty meta description',
        actual: exists ? `"${content.slice(0, 80)}..."` : 'Missing or empty',
        helpUrl: 'https://developers.google.com/search/docs/appearance/snippet',
      });

      if (exists) {
        cy.saveAuditResult({
          id: 'seo-description-length',
          name: 'Meta description length',
          category: 'seo',
          severity: 'warning',
          status: goodLength ? 'pass' : 'fail',
          description: 'Meta description should be 120-160 characters',
          expected: '120-160 characters',
          actual: `${content.length} characters`,
        });
      }
    });
  });

  // ──────────────────────────────────────────────
  // VIEWPORT
  // ──────────────────────────────────────────────

  it('should have a viewport meta tag', () => {
    cy.get('head').then(($head) => {
      const viewport = $head.find('meta[name="viewport"]');
      const content = viewport.attr('content') || '';
      const hasWidth = content.includes('width=device-width');

      cy.saveAuditResult({
        id: 'seo-viewport',
        name: 'Viewport meta tag',
        category: 'seo',
        severity: 'critical',
        status: viewport.length > 0 && hasWidth ? 'pass' : 'fail',
        description: 'Page must have a viewport meta tag for mobile compatibility',
        expected: '<meta name="viewport" content="width=device-width, initial-scale=1">',
        actual: viewport.length > 0 ? `content="${content}"` : 'Missing',
        helpUrl: 'https://web.dev/viewport/',
      });
    });
  });

  // ──────────────────────────────────────────────
  // OPEN GRAPH TAGS
  // ──────────────────────────────────────────────

  it('should have Open Graph meta tags', () => {
    const requiredOgTags = ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'];

    cy.get('head').then(($head) => {
      requiredOgTags.forEach((tag) => {
        const el = $head.find(`meta[property="${tag}"]`);
        const content = el.attr('content') || '';

        cy.saveAuditResult({
          id: `seo-og-${tag}`,
          name: `Open Graph: ${tag}`,
          category: 'seo',
          severity: tag === 'og:title' || tag === 'og:description' ? 'warning' : 'info',
          status: el.length > 0 && content.length > 0 ? 'pass' : 'fail',
          description: `Page should have ${tag} meta tag for social media sharing`,
          expected: `<meta property="${tag}" content="...">`,
          actual: el.length > 0 ? `content="${content.slice(0, 80)}"` : 'Missing',
          helpUrl: 'https://ogp.me/',
        });
      });
    });
  });

  // ──────────────────────────────────────────────
  // TWITTER CARD TAGS
  // ──────────────────────────────────────────────

  it('should have Twitter Card meta tags', () => {
    const twitterTags = ['twitter:card', 'twitter:title', 'twitter:description'];

    cy.get('head').then(($head) => {
      twitterTags.forEach((tag) => {
        const el = $head.find(`meta[name="${tag}"]`);
        const content = el.attr('content') || '';

        cy.saveAuditResult({
          id: `seo-${tag}`,
          name: `Twitter Card: ${tag}`,
          category: 'seo',
          severity: 'info',
          status: el.length > 0 && content.length > 0 ? 'pass' : 'fail',
          description: `Page should have ${tag} for Twitter/X sharing`,
          expected: `<meta name="${tag}" content="...">`,
          actual: el.length > 0 ? `content="${content.slice(0, 80)}"` : 'Missing',
          helpUrl: 'https://developer.x.com/en/docs/twitter-for-websites/cards/overview/markup',
        });
      });
    });
  });

  // ──────────────────────────────────────────────
  // CANONICAL URL
  // ──────────────────────────────────────────────

  it('should have a canonical URL', () => {
    cy.get('head').then(($head) => {
      const canonical = $head.find('link[rel="canonical"]');
      const href = canonical.attr('href') || '';

      cy.saveAuditResult({
        id: 'seo-canonical',
        name: 'Canonical URL',
        category: 'seo',
        severity: 'warning',
        status: canonical.length > 0 && href.length > 0 ? 'pass' : 'fail',
        description: 'Page should have a canonical URL to prevent duplicate content issues',
        expected: '<link rel="canonical" href="...">',
        actual: canonical.length > 0 ? `href="${href}"` : 'Missing',
        helpUrl: 'https://developers.google.com/search/docs/crawling-indexing/canonicalization',
      });
    });
  });

  // ──────────────────────────────────────────────
  // HEADING STRUCTURE FOR SEO
  // ──────────────────────────────────────────────

  it('should have SEO-friendly heading structure', () => {
    cy.document().then((doc) => {
      const h1Count = doc.querySelectorAll('h1').length;

      cy.saveAuditResult({
        id: 'seo-h1',
        name: 'H1 tag for SEO',
        category: 'seo',
        severity: 'critical',
        status: h1Count === 1 ? 'pass' : 'fail',
        description: 'Page should have exactly one H1 tag for SEO',
        expected: 'Exactly 1 H1 element',
        actual: `${h1Count} H1 element(s) found`,
        helpUrl: 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide#use-headings',
      });
    });
  });

  // ──────────────────────────────────────────────
  // ROBOTS META
  // ──────────────────────────────────────────────

  it('should not block search engine indexing unintentionally', () => {
    cy.get('head').then(($head) => {
      const robotsMeta = $head.find('meta[name="robots"]');
      const content = (robotsMeta.attr('content') || '').toLowerCase();
      const isBlocked = content.includes('noindex');

      cy.saveAuditResult({
        id: 'seo-robots',
        name: 'Robots meta directives',
        category: 'seo',
        severity: 'info',
        status: isBlocked ? 'warning' : 'pass',
        description: 'Check if page is blocking search engine indexing',
        expected: 'No noindex directive (unless intentional)',
        actual: robotsMeta.length > 0 ? `content="${content}"` : 'No robots meta (defaults to index)',
      });
    });
  });

  // ──────────────────────────────────────────────
  // STRUCTURED DATA (JSON-LD)
  // ──────────────────────────────────────────────

  it('should have structured data (JSON-LD)', () => {
    cy.document().then((doc) => {
      const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
      const hasStructuredData = scripts.length > 0;
      let isValid = false;

      if (hasStructuredData) {
        try {
          JSON.parse(scripts[0].textContent || '');
          isValid = true;
        } catch {
          isValid = false;
        }
      }

      cy.saveAuditResult({
        id: 'seo-jsonld',
        name: 'Structured data (JSON-LD)',
        category: 'seo',
        severity: 'info',
        status: hasStructuredData && isValid ? 'pass' : 'fail',
        description: 'Structured data helps search engines understand page content',
        expected: 'Valid JSON-LD script tag',
        actual: hasStructuredData
          ? isValid
            ? `Found ${scripts.length} JSON-LD block(s)`
            : 'Invalid JSON in JSON-LD'
          : 'No structured data found',
        helpUrl: 'https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data',
      });
    });
  });

  // ──────────────────────────────────────────────
  // IMAGE SEO
  // ──────────────────────────────────────────────

  it('should have SEO-friendly images', () => {
    cy.get('img').each(($img) => {
      const alt = $img.attr('alt');
      const width = $img.attr('width');
      const height = $img.attr('height');
      const loading = $img.attr('loading');
      const html = $img[0].outerHTML.slice(0, 150);

      // Check explicit dimensions (helps prevent CLS)
      cy.saveAuditResult({
        id: `seo-img-dimensions-${Cypress._.uniqueId()}`,
        name: 'Image explicit dimensions',
        category: 'seo',
        severity: 'warning',
        status: width && height ? 'pass' : 'fail',
        description: 'Images should have explicit width and height to prevent layout shift',
        element: html,
        expected: 'width and height attributes',
        actual: width && height ? `${width}x${height}` : 'Missing dimensions',
        helpUrl: 'https://web.dev/cls/',
      });

      // Check lazy loading
      cy.saveAuditResult({
        id: `seo-img-lazy-${Cypress._.uniqueId()}`,
        name: 'Image lazy loading',
        category: 'seo',
        severity: 'info',
        status: loading === 'lazy' ? 'pass' : 'warning',
        description: 'Below-the-fold images should use loading="lazy"',
        element: html,
        expected: 'loading="lazy"',
        actual: loading ? `loading="${loading}"` : 'No loading attribute',
        helpUrl: 'https://web.dev/browser-level-image-lazy-loading/',
      });
    });
  });
});
