import { test, expect, createAuditCollector } from '../../support/audit-fixture';

const audit = createAuditCollector();

test.afterAll(async ({ baseURL }) => {
  audit.flush(baseURL || 'unknown');
});

test.describe('SEO Audit', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.goto(baseURL || '/');
  });

  // ──────────────────────────────────────────────
  // META TAGS
  // ──────────────────────────────────────────────

  test('should have a proper meta title', async ({ page }) => {
    const title = await page.title();
    const exists = !!title && title.length > 0;
    const goodLength = title.length >= 30 && title.length <= 60;

    audit.save({
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
      audit.save({
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

  test('should have a proper meta description', async ({ page }) => {
    const meta = await page.evaluate(() => {
      const el = document.querySelector('meta[name="description"]');
      return el ? el.getAttribute('content') || '' : '';
    });

    const exists = meta.length > 0;
    const goodLength = meta.length >= 120 && meta.length <= 160;

    audit.save({
      id: 'seo-description-exists',
      name: 'Meta description exists',
      category: 'seo',
      severity: 'critical',
      status: exists ? 'pass' : 'fail',
      description: 'Page must have a meta description for search engine snippets',
      expected: 'Non-empty meta description',
      actual: exists ? `"${meta.slice(0, 80)}..."` : 'Missing or empty',
      helpUrl: 'https://developers.google.com/search/docs/appearance/snippet',
    });

    if (exists) {
      audit.save({
        id: 'seo-description-length',
        name: 'Meta description length',
        category: 'seo',
        severity: 'warning',
        status: goodLength ? 'pass' : 'fail',
        description: 'Meta description should be 120-160 characters',
        expected: '120-160 characters',
        actual: `${meta.length} characters`,
      });
    }
  });

  // ──────────────────────────────────────────────
  // VIEWPORT
  // ──────────────────────────────────────────────

  test('should have a viewport meta tag', async ({ page }) => {
    const viewport = await page.evaluate(() => {
      const el = document.querySelector('meta[name="viewport"]');
      return el ? el.getAttribute('content') || '' : '';
    });

    const hasWidth = viewport.includes('width=device-width');

    audit.save({
      id: 'seo-viewport',
      name: 'Viewport meta tag',
      category: 'seo',
      severity: 'critical',
      status: viewport && hasWidth ? 'pass' : 'fail',
      description: 'Page must have a viewport meta tag for mobile compatibility',
      expected: '<meta name="viewport" content="width=device-width, initial-scale=1">',
      actual: viewport ? `content="${viewport}"` : 'Missing',
      helpUrl: 'https://web.dev/viewport/',
    });
  });

  // ──────────────────────────────────────────────
  // OPEN GRAPH TAGS
  // ──────────────────────────────────────────────

  test('should have Open Graph meta tags', async ({ page }) => {
    const requiredOgTags = ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'];

    const ogData = await page.evaluate((tags) => {
      return tags.map((tag) => {
        const el = document.querySelector(`meta[property="${tag}"]`);
        return { tag, content: el ? el.getAttribute('content') || '' : '' };
      });
    }, requiredOgTags);

    for (const og of ogData) {
      const exists = og.content.length > 0;

      audit.save({
        id: `seo-og-${og.tag}`,
        name: `Open Graph: ${og.tag}`,
        category: 'seo',
        severity: og.tag === 'og:title' || og.tag === 'og:description' ? 'warning' : 'info',
        status: exists ? 'pass' : 'fail',
        description: `Page should have ${og.tag} meta tag for social media sharing`,
        expected: `<meta property="${og.tag}" content="...">`,
        actual: exists ? `content="${og.content.slice(0, 80)}"` : 'Missing',
        helpUrl: 'https://ogp.me/',
      });
    }
  });

  // ──────────────────────────────────────────────
  // TWITTER CARD TAGS
  // ──────────────────────────────────────────────

  test('should have Twitter Card meta tags', async ({ page }) => {
    const twitterTags = ['twitter:card', 'twitter:title', 'twitter:description'];

    const twitterData = await page.evaluate((tags) => {
      return tags.map((tag) => {
        const el = document.querySelector(`meta[name="${tag}"]`);
        return { tag, content: el ? el.getAttribute('content') || '' : '' };
      });
    }, twitterTags);

    for (const tw of twitterData) {
      const exists = tw.content.length > 0;

      audit.save({
        id: `seo-${tw.tag}`,
        name: `Twitter Card: ${tw.tag}`,
        category: 'seo',
        severity: 'info',
        status: exists ? 'pass' : 'fail',
        description: `Page should have ${tw.tag} for Twitter/X sharing`,
        expected: `<meta name="${tw.tag}" content="...">`,
        actual: exists ? `content="${tw.content.slice(0, 80)}"` : 'Missing',
        helpUrl: 'https://developer.x.com/en/docs/twitter-for-websites/cards/overview/markup',
      });
    }
  });

  // ──────────────────────────────────────────────
  // CANONICAL URL
  // ──────────────────────────────────────────────

  test('should have a canonical URL', async ({ page }) => {
    const canonical = await page.evaluate(() => {
      const el = document.querySelector('link[rel="canonical"]');
      return el ? el.getAttribute('href') || '' : '';
    });

    audit.save({
      id: 'seo-canonical',
      name: 'Canonical URL',
      category: 'seo',
      severity: 'warning',
      status: canonical.length > 0 ? 'pass' : 'fail',
      description: 'Page should have a canonical URL to prevent duplicate content issues',
      expected: '<link rel="canonical" href="...">',
      actual: canonical ? `href="${canonical}"` : 'Missing',
      helpUrl: 'https://developers.google.com/search/docs/crawling-indexing/canonicalization',
    });
  });

  // ──────────────────────────────────────────────
  // HEADING STRUCTURE FOR SEO
  // ──────────────────────────────────────────────

  test('should have SEO-friendly heading structure', async ({ page }) => {
    const h1Count = await page.evaluate(() => document.querySelectorAll('h1').length);

    audit.save({
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

  // ──────────────────────────────────────────────
  // ROBOTS META
  // ──────────────────────────────────────────────

  test('should not block search engine indexing unintentionally', async ({ page }) => {
    const robots = await page.evaluate(() => {
      const el = document.querySelector('meta[name="robots"]');
      return el ? (el.getAttribute('content') || '').toLowerCase() : '';
    });

    const isBlocked = robots.includes('noindex');

    audit.save({
      id: 'seo-robots',
      name: 'Robots meta directives',
      category: 'seo',
      severity: 'info',
      status: isBlocked ? 'warning' : 'pass',
      description: 'Check if page is blocking search engine indexing',
      expected: 'No noindex directive (unless intentional)',
      actual: robots ? `content="${robots}"` : 'No robots meta (defaults to index)',
    });
  });

  // ──────────────────────────────────────────────
  // STRUCTURED DATA (JSON-LD)
  // ──────────────────────────────────────────────

  test('should have structured data (JSON-LD)', async ({ page }) => {
    const jsonLd = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      if (scripts.length === 0) return { count: 0, valid: false };
      try {
        JSON.parse(scripts[0].textContent || '');
        return { count: scripts.length, valid: true };
      } catch {
        return { count: scripts.length, valid: false };
      }
    });

    audit.save({
      id: 'seo-jsonld',
      name: 'Structured data (JSON-LD)',
      category: 'seo',
      severity: 'info',
      status: jsonLd.count > 0 && jsonLd.valid ? 'pass' : 'fail',
      description: 'Structured data helps search engines understand page content',
      expected: 'Valid JSON-LD script tag',
      actual:
        jsonLd.count > 0
          ? jsonLd.valid
            ? `Found ${jsonLd.count} JSON-LD block(s)`
            : 'Invalid JSON in JSON-LD'
          : 'No structured data found',
      helpUrl: 'https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data',
    });
  });

  // ──────────────────────────────────────────────
  // IMAGE SEO
  // ──────────────────────────────────────────────

  test('should have SEO-friendly images', async ({ page }) => {
    const images = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img')).map((img) => ({
        width: img.getAttribute('width'),
        height: img.getAttribute('height'),
        loading: img.getAttribute('loading'),
        html: img.outerHTML.slice(0, 150),
      }));
    });

    for (const img of images) {
      audit.save({
        id: `seo-img-dimensions-${Math.random().toString(36).slice(2, 6)}`,
        name: 'Image explicit dimensions',
        category: 'seo',
        severity: 'warning',
        status: img.width && img.height ? 'pass' : 'fail',
        description: 'Images should have explicit width and height to prevent layout shift',
        element: img.html,
        expected: 'width and height attributes',
        actual: img.width && img.height ? `${img.width}x${img.height}` : 'Missing dimensions',
        helpUrl: 'https://web.dev/cls/',
      });

      audit.save({
        id: `seo-img-lazy-${Math.random().toString(36).slice(2, 6)}`,
        name: 'Image lazy loading',
        category: 'seo',
        severity: 'info',
        status: img.loading === 'lazy' ? 'pass' : 'warning',
        description: 'Below-the-fold images should use loading="lazy"',
        element: img.html,
        expected: 'loading="lazy"',
        actual: img.loading ? `loading="${img.loading}"` : 'No loading attribute',
        helpUrl: 'https://web.dev/browser-level-image-lazy-loading/',
      });
    }
  });
});
