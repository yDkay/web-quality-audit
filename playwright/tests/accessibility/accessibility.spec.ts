import { test, expect, parseRgb, getContrastRatio, createAuditCollector } from '../../support/audit-fixture';

const audit = createAuditCollector();

test.afterAll(async ({ baseURL }) => {
  audit.flush(baseURL || 'unknown');
});

test.describe('Accessibility Audit', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.goto(baseURL || '/');
  });

  // ──────────────────────────────────────────────
  // AXE-CORE AUTOMATED CHECKS
  // ──────────────────────────────────────────────

  test('should pass axe-core WCAG 2.1 AA analysis', async ({ helpers }) => {
    const results = await helpers.runAxe(['wcag2a', 'wcag2aa', 'wcag21aa']);

    for (const violation of results.violations) {
      for (const node of violation.nodes) {
        audit.save({
          id: `axe-${violation.id}-${Math.random().toString(36).slice(2, 6)}`,
          name: violation.id,
          category: 'accessibility',
          severity:
            violation.impact === 'critical' || violation.impact === 'serious'
              ? 'critical'
              : 'warning',
          status: 'fail',
          description: violation.description,
          details: node.failureSummary || '',
          element: node.html.slice(0, 200),
          helpUrl: violation.helpUrl,
        });
      }
    }
  });

  test('should pass axe-core best practices analysis', async ({ helpers }) => {
    const results = await helpers.runAxe(['best-practice']);

    for (const violation of results.violations) {
      for (const node of violation.nodes) {
        audit.save({
          id: `axe-bp-${violation.id}-${Math.random().toString(36).slice(2, 6)}`,
          name: violation.id,
          category: 'accessibility',
          severity: 'warning',
          status: 'fail',
          description: violation.description,
          details: node.failureSummary || '',
          element: node.html.slice(0, 200),
          helpUrl: violation.helpUrl,
        });
      }
    }
  });

  // ──────────────────────────────────────────────
  // CUSTOM CHECKS: COLOR CONTRAST
  // ──────────────────────────────────────────────

  test('should have sufficient color contrast on text elements', async ({ page }) => {
    const textData = await page.evaluate(() => {
      const selectors = 'p, h1, h2, h3, h4, h5, h6, span, a, li, td, th, label, button';
      const elements = document.querySelectorAll(selectors);
      const results: {
        color: string;
        bgColor: string;
        fontSize: number;
        fontWeight: number;
        html: string;
        visible: boolean;
        hasText: boolean;
      }[] = [];

      function getEffectiveBg(el: HTMLElement): string {
        let current: HTMLElement | null = el;
        while (current) {
          const bg = window.getComputedStyle(current).backgroundColor;
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
          current = current.parentElement;
        }
        return 'rgb(255, 255, 255)';
      }

      elements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        const styles = window.getComputedStyle(htmlEl);
        const rect = htmlEl.getBoundingClientRect();

        results.push({
          color: styles.color,
          bgColor: getEffectiveBg(htmlEl),
          fontSize: parseFloat(styles.fontSize),
          fontWeight: parseInt(styles.fontWeight, 10),
          html: htmlEl.outerHTML.slice(0, 120),
          visible: rect.width > 0 && rect.height > 0,
          hasText: (htmlEl.textContent || '').trim().length > 0,
        });
      });

      return results;
    });

    for (const el of textData) {
      if (!el.visible || !el.hasText) continue;

      const fgRgb = parseRgb(el.color);
      const bgRgb = parseRgb(el.bgColor);
      if (!fgRgb || !bgRgb) continue;

      const ratio = getContrastRatio(fgRgb, bgRgb);
      const isLargeText = el.fontSize >= 24 || (el.fontSize >= 18.66 && el.fontWeight >= 700);
      const requiredAA = isLargeText ? 3 : 4.5;
      const requiredAAA = isLargeText ? 4.5 : 7;
      const passesAA = ratio >= requiredAA;

      audit.save({
        id: `contrast-${Math.random().toString(36).slice(2, 6)}`,
        name: 'Color contrast ratio',
        category: 'accessibility',
        severity: passesAA ? 'info' : 'critical',
        status: passesAA ? 'pass' : 'fail',
        description: `Text must meet WCAG AA contrast ratio (${requiredAA}:1 for ${isLargeText ? 'large' : 'normal'} text)`,
        element: el.html,
        expected: `>= ${requiredAA}:1 (AA), >= ${requiredAAA}:1 (AAA)`,
        actual: `${ratio.toFixed(2)}:1 | fg: ${el.color} | bg: ${el.bgColor}`,
        helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html',
      });
    }
  });

  // ──────────────────────────────────────────────
  // CUSTOM CHECKS: HEADING HIERARCHY
  // ──────────────────────────────────────────────

  test('should have a valid heading hierarchy', async ({ page }) => {
    const headings = await page.evaluate(() => {
      const els = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      return Array.from(els).map((el) => ({
        level: parseInt(el.tagName.replace('H', ''), 10),
        text: (el.textContent || '').trim(),
        html: (el as HTMLElement).outerHTML.slice(0, 120),
      }));
    });

    // Check: exactly one h1
    const h1Count = headings.filter((h) => h.level === 1).length;

    audit.save({
      id: 'heading-h1-count',
      name: 'Single H1 element',
      category: 'accessibility',
      severity: h1Count === 0 ? 'critical' : 'warning',
      status: h1Count === 1 ? 'pass' : 'fail',
      description: 'Page should contain exactly one H1 element',
      expected: '1',
      actual: `${h1Count}`,
      helpUrl: 'https://www.w3.org/WAI/tutorials/page-structure/headings/',
    });

    // Check: no skipped levels
    for (let i = 1; i < headings.length; i++) {
      const current = headings[i];
      const previous = headings[i - 1];

      if (current.level > previous.level + 1) {
        audit.save({
          id: `heading-skip-${i}`,
          name: 'Heading level skip',
          category: 'accessibility',
          severity: 'warning',
          status: 'fail',
          description: `Heading skips from H${previous.level} to H${current.level}`,
          element: current.html,
          expected: `H${previous.level + 1} or same/higher level`,
          actual: `H${current.level}: "${current.text}"`,
          helpUrl: 'https://www.w3.org/WAI/tutorials/page-structure/headings/',
        });
      }
    }
  });

  // ──────────────────────────────────────────────
  // CUSTOM CHECKS: IMAGES
  // ──────────────────────────────────────────────

  test('should have meaningful alt text on images', async ({ page }) => {
    const images = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img')).map((img) => ({
        alt: img.getAttribute('alt'),
        html: img.outerHTML.slice(0, 150),
      }));
    });

    for (const img of images) {
      if (img.alt === null) {
        audit.save({
          id: `img-alt-missing-${Math.random().toString(36).slice(2, 6)}`,
          name: 'Image missing alt attribute',
          category: 'accessibility',
          severity: 'critical',
          status: 'fail',
          description: 'All images must have an alt attribute',
          element: img.html,
          expected: 'alt attribute present',
          actual: 'No alt attribute',
          helpUrl: 'https://www.w3.org/WAI/tutorials/images/',
        });
        continue;
      }

      const uselessPatterns = ['image', 'photo', 'picture', 'img', 'untitled', 'screenshot'];
      const isUseless = uselessPatterns.some((p) => img.alt!.toLowerCase().trim() === p);

      if (isUseless) {
        audit.save({
          id: `img-alt-useless-${Math.random().toString(36).slice(2, 6)}`,
          name: 'Image has non-descriptive alt text',
          category: 'accessibility',
          severity: 'warning',
          status: 'fail',
          description: 'Alt text should meaningfully describe the image content',
          element: img.html,
          expected: 'Descriptive alt text',
          actual: `alt="${img.alt}"`,
          helpUrl: 'https://www.w3.org/WAI/tutorials/images/',
        });
      }
    }
  });

  // ──────────────────────────────────────────────
  // CUSTOM CHECKS: FORM ACCESSIBILITY
  // ──────────────────────────────────────────────

  test('should have accessible form elements', async ({ page }) => {
    const inputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input, select, textarea')).map((el) => {
        const input = el as HTMLInputElement;
        const id = input.getAttribute('id');
        return {
          type: input.getAttribute('type') || 'text',
          hasAriaLabel: !!input.getAttribute('aria-label'),
          hasAriaLabelledBy: !!input.getAttribute('aria-labelledby'),
          hasTitle: !!input.getAttribute('title'),
          hasLabelFor: !!(id && document.querySelector(`label[for="${id}"]`)),
          hasParentLabel: !!input.closest('label'),
          html: input.outerHTML.slice(0, 150),
        };
      });
    });

    for (const input of inputs) {
      if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button') continue;

      const hasLabel =
        input.hasAriaLabel ||
        input.hasAriaLabelledBy ||
        input.hasTitle ||
        input.hasLabelFor ||
        input.hasParentLabel;

      audit.save({
        id: `form-label-${Math.random().toString(36).slice(2, 6)}`,
        name: 'Form input has associated label',
        category: 'accessibility',
        severity: 'critical',
        status: hasLabel ? 'pass' : 'fail',
        description: 'Every form input must have an associated label, aria-label, or title',
        element: input.html,
        expected: 'Label, aria-label, aria-labelledby, or title attribute',
        actual: hasLabel ? 'Label found' : 'No label association',
        helpUrl: 'https://www.w3.org/WAI/tutorials/forms/labels/',
      });
    }
  });

  // ──────────────────────────────────────────────
  // CUSTOM CHECKS: TOUCH TARGETS
  // ──────────────────────────────────────────────

  test('should have adequately sized touch targets', async ({ page }) => {
    const minSize = 44;

    const targets = await page.evaluate(() => {
      const selector = 'a, button, [role="button"], input[type="submit"], input[type="button"]';
      return Array.from(document.querySelectorAll(selector)).map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          visible: rect.width > 0 && rect.height > 0,
          html: (el as HTMLElement).outerHTML.slice(0, 120),
        };
      });
    });

    for (const target of targets) {
      if (!target.visible) continue;

      const tooSmall = target.width < minSize || target.height < minSize;

      audit.save({
        id: `touch-target-${Math.random().toString(36).slice(2, 6)}`,
        name: 'Touch target size',
        category: 'accessibility',
        severity: 'warning',
        status: tooSmall ? 'fail' : 'pass',
        description: `Interactive elements should be at least ${minSize}x${minSize}px`,
        element: target.html,
        expected: `${minSize}x${minSize}px minimum`,
        actual: `${target.width}x${target.height}px`,
        helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/target-size.html',
      });
    }
  });

  // ──────────────────────────────────────────────
  // CUSTOM CHECKS: LINK TEXT QUALITY
  // ──────────────────────────────────────────────

  test('should have descriptive link text', async ({ page }) => {
    const genericPhrases = ['click here', 'read more', 'more', 'link', 'here', 'learn more', 'details', 'this'];

    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).map((a) => ({
        text: (a.textContent || '').trim().toLowerCase(),
        ariaLabel: a.getAttribute('aria-label'),
        html: a.outerHTML.slice(0, 120),
      }));
    });

    for (const link of links) {
      if (!link.text && !link.ariaLabel) {
        audit.save({
          id: `link-empty-${Math.random().toString(36).slice(2, 6)}`,
          name: 'Empty link text',
          category: 'accessibility',
          severity: 'critical',
          status: 'fail',
          description: 'Links must have discernible text content',
          element: link.html,
          expected: 'Descriptive text or aria-label',
          actual: 'Empty link',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/link-purpose-in-context.html',
        });
        continue;
      }

      const isGeneric = genericPhrases.includes(link.text);

      if (isGeneric && !link.ariaLabel) {
        audit.save({
          id: `link-generic-${Math.random().toString(36).slice(2, 6)}`,
          name: 'Generic link text',
          category: 'accessibility',
          severity: 'warning',
          status: 'fail',
          description: `Link text "${link.text}" is not descriptive enough`,
          element: link.html,
          expected: 'Descriptive link text that makes sense out of context',
          actual: `"${link.text}"`,
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/link-purpose-in-context.html',
        });
      }
    }
  });

  // ──────────────────────────────────────────────
  // CUSTOM CHECKS: DOCUMENT-LEVEL A11Y
  // ──────────────────────────────────────────────

  test('should have required document-level accessibility attributes', async ({ page }) => {
    const lang = await page.getAttribute('html', 'lang');

    audit.save({
      id: 'doc-lang',
      name: 'HTML lang attribute',
      category: 'accessibility',
      severity: 'critical',
      status: lang ? 'pass' : 'fail',
      description: 'The <html> element must have a valid lang attribute',
      expected: 'lang="en" or other valid language code',
      actual: lang ? `lang="${lang}"` : 'Missing',
      helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/language-of-page.html',
    });

    const title = await page.title();
    const isTooShort = !title || title.length < 5;

    audit.save({
      id: 'doc-title',
      name: 'Document title',
      category: 'accessibility',
      severity: 'warning',
      status: isTooShort ? 'fail' : 'pass',
      description: 'Page should have a descriptive title (at least 5 characters)',
      expected: 'Descriptive title >= 5 characters',
      actual: title ? `"${title}" (${title.length} chars)` : 'Missing',
      helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/page-titled.html',
    });
  });

  // ──────────────────────────────────────────────
  // CUSTOM CHECKS: LINKS OPENING IN NEW TAB
  // ──────────────────────────────────────────────

  test('should warn users when links open in a new tab', async ({ page }) => {
    const blankLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[target="_blank"]')).map((a) => {
        const text = (a.textContent || '').trim();
        const ariaLabel = a.getAttribute('aria-label') || '';
        const srOnly = a.querySelector('.sr-only, .visually-hidden');
        const mentionsNewTab =
          text.includes('new tab') ||
          text.includes('new window') ||
          ariaLabel.includes('new tab') ||
          ariaLabel.includes('new window') ||
          (srOnly?.textContent || '').includes('new');

        return {
          html: (a as HTMLElement).outerHTML.slice(0, 150),
          mentionsNewTab,
        };
      });
    });

    for (const link of blankLinks) {
      audit.save({
        id: `link-newtab-${Math.random().toString(36).slice(2, 6)}`,
        name: 'New tab link warning',
        category: 'accessibility',
        severity: 'warning',
        status: link.mentionsNewTab ? 'pass' : 'fail',
        description: 'Links that open in a new tab should indicate this to users',
        element: link.html,
        expected: 'Visual or SR-only indicator for target="_blank"',
        actual: link.mentionsNewTab ? 'Indicator found' : 'No indicator',
        helpUrl: 'https://www.w3.org/WAI/WCAG21/Techniques/general/G200',
      });
    }
  });
});
