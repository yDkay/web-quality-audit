describe('Accessibility Audit', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.injectAxe();
  });

  // ──────────────────────────────────────────────
  // AXE-CORE AUTOMATED CHECKS
  // ──────────────────────────────────────────────

  it('should pass axe-core WCAG 2.1 AA analysis', () => {
    cy.checkA11y(
      undefined,
      {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21aa'],
        },
      },
      (violations) => {
        violations.forEach((violation) => {
          violation.nodes.forEach((node) => {
            cy.saveAuditResult({
              id: `axe-${violation.id}-${Cypress._.uniqueId()}`,
              name: violation.id,
              category: 'accessibility',
              severity: violation.impact === 'critical' || violation.impact === 'serious'
                ? 'critical'
                : 'warning',
              status: 'fail',
              description: violation.description,
              details: node.failureSummary || '',
              element: node.html.slice(0, 200),
              helpUrl: violation.helpUrl,
            });
          });
        });
      },
      // Don't fail the test -- we're collecting results, not gating
      true
    );
  });

  it('should pass axe-core best practices analysis', () => {
    cy.checkA11y(
      undefined,
      {
        runOnly: {
          type: 'tag',
          values: ['best-practice'],
        },
      },
      (violations) => {
        violations.forEach((violation) => {
          violation.nodes.forEach((node) => {
            cy.saveAuditResult({
              id: `axe-bp-${violation.id}-${Cypress._.uniqueId()}`,
              name: violation.id,
              category: 'accessibility',
              severity: 'warning',
              status: 'fail',
              description: violation.description,
              details: node.failureSummary || '',
              element: node.html.slice(0, 200),
              helpUrl: violation.helpUrl,
            });
          });
        });
      },
      true
    );
  });

  // ──────────────────────────────────────────────
  // CUSTOM CHECKS: COLOR CONTRAST (deeper than axe)
  // ──────────────────────────────────────────────

  it('should have sufficient color contrast on text elements', () => {
    const textSelectors = 'p, h1, h2, h3, h4, h5, h6, span, a, li, td, th, label, button';

    cy.get(textSelectors).each(($el) => {
      // Skip hidden/empty elements
      if (!$el.is(':visible') || $el.text().trim() === '') return;

      const styles = window.getComputedStyle($el[0]);
      const color = styles.color;
      const bgColor = getEffectiveBackgroundColor($el[0]);
      const fontSize = parseFloat(styles.fontSize);
      const fontWeight = parseInt(styles.fontWeight, 10);

      const fgRgb = parseRgb(color);
      const bgRgb = parseRgb(bgColor);

      if (!fgRgb || !bgRgb) return;

      const ratio = getContrastRatio(fgRgb, bgRgb);
      const isLargeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
      const requiredAA = isLargeText ? 3 : 4.5;
      const requiredAAA = isLargeText ? 4.5 : 7;

      const passesAA = ratio >= requiredAA;

      cy.saveAuditResult({
        id: `contrast-${Cypress._.uniqueId()}`,
        name: 'Color contrast ratio',
        category: 'accessibility',
        severity: passesAA ? 'info' : 'critical',
        status: passesAA ? 'pass' : 'fail',
        description: `Text must meet WCAG AA contrast ratio (${requiredAA}:1 for ${isLargeText ? 'large' : 'normal'} text)`,
        element: $el[0].outerHTML.slice(0, 120),
        expected: `>= ${requiredAA}:1 (AA), >= ${requiredAAA}:1 (AAA)`,
        actual: `${ratio.toFixed(2)}:1 | fg: ${color} | bg: ${bgColor}`,
        helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html',
      });
    });
  });

  // ──────────────────────────────────────────────
  // CUSTOM CHECKS: HEADING HIERARCHY
  // ──────────────────────────────────────────────

  it('should have a valid heading hierarchy', () => {
    const headings: { level: number; text: string; html: string }[] = [];

    cy.get('h1, h2, h3, h4, h5, h6').each(($el) => {
      const tagName = $el.prop('tagName');
      headings.push({
        level: parseInt(tagName.replace('H', ''), 10),
        text: $el.text().trim(),
        html: $el[0].outerHTML.slice(0, 120),
      });
    }).then(() => {
      // Check: page should have exactly one h1
      const h1Count = headings.filter((h) => h.level === 1).length;

      cy.saveAuditResult({
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

      // Check: headings should not skip levels
      for (let i = 1; i < headings.length; i++) {
        const current = headings[i];
        const previous = headings[i - 1];
        const skipped = current.level > previous.level + 1;

        if (skipped) {
          cy.saveAuditResult({
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
  });

  // ──────────────────────────────────────────────
  // CUSTOM CHECKS: IMAGES
  // ──────────────────────────────────────────────

  it('should have meaningful alt text on images', () => {
    cy.get('img').each(($img) => {
      const alt = $img.attr('alt');
      const html = $img[0].outerHTML.slice(0, 150);

      // Missing alt attribute entirely
      if (alt === undefined) {
        cy.saveAuditResult({
          id: `img-alt-missing-${Cypress._.uniqueId()}`,
          name: 'Image missing alt attribute',
          category: 'accessibility',
          severity: 'critical',
          status: 'fail',
          description: 'All images must have an alt attribute',
          element: html,
          expected: 'alt attribute present',
          actual: 'No alt attribute',
          helpUrl: 'https://www.w3.org/WAI/tutorials/images/',
        });
        return;
      }

      // Useless alt text patterns
      const uselessPatterns = ['image', 'photo', 'picture', 'img', 'untitled', 'screenshot'];
      const isUseless = uselessPatterns.some(
        (pattern) => alt.toLowerCase().trim() === pattern
      );

      if (isUseless) {
        cy.saveAuditResult({
          id: `img-alt-useless-${Cypress._.uniqueId()}`,
          name: 'Image has non-descriptive alt text',
          category: 'accessibility',
          severity: 'warning',
          status: 'fail',
          description: 'Alt text should meaningfully describe the image content',
          element: html,
          expected: 'Descriptive alt text',
          actual: `alt="${alt}"`,
          helpUrl: 'https://www.w3.org/WAI/tutorials/images/',
        });
      }
    });
  });

  // ──────────────────────────────────────────────
  // CUSTOM CHECKS: FORM ACCESSIBILITY
  // ──────────────────────────────────────────────

  it('should have accessible form elements', () => {
    cy.get('input, select, textarea').each(($input) => {
      const id = $input.attr('id');
      const ariaLabel = $input.attr('aria-label');
      const ariaLabelledBy = $input.attr('aria-labelledby');
      const title = $input.attr('title');
      const type = $input.attr('type') || 'text';
      const html = $input[0].outerHTML.slice(0, 150);

      // Skip hidden and submit/button inputs
      if (type === 'hidden' || type === 'submit' || type === 'button') return;

      // Check if input has an associated label
      const hasLabel =
        ariaLabel ||
        ariaLabelledBy ||
        title ||
        (id && Cypress.$(`label[for="${id}"]`).length > 0) ||
        $input.closest('label').length > 0;

      cy.saveAuditResult({
        id: `form-label-${Cypress._.uniqueId()}`,
        name: 'Form input has associated label',
        category: 'accessibility',
        severity: 'critical',
        status: hasLabel ? 'pass' : 'fail',
        description: 'Every form input must have an associated label, aria-label, or title',
        element: html,
        expected: 'Label, aria-label, aria-labelledby, or title attribute',
        actual: hasLabel ? 'Label found' : 'No label association',
        helpUrl: 'https://www.w3.org/WAI/tutorials/forms/labels/',
      });
    });
  });

  // ──────────────────────────────────────────────
  // CUSTOM CHECKS: TOUCH TARGETS
  // ──────────────────────────────────────────────

  it('should have adequately sized touch targets', () => {
    cy.get('a, button, [role="button"], input[type="submit"], input[type="button"]').each(
      ($el) => {
        if (!$el.is(':visible')) return;
        cy.wrap($el).checkTouchTarget(44);
      }
    );
  });

  // ──────────────────────────────────────────────
  // CUSTOM CHECKS: LINK TEXT QUALITY
  // ──────────────────────────────────────────────

  it('should have descriptive link text', () => {
    const genericPhrases = [
      'click here',
      'read more',
      'more',
      'link',
      'here',
      'learn more',
      'details',
      'this',
    ];

    cy.get('a').each(($link) => {
      const text = $link.text().trim().toLowerCase();
      const ariaLabel = $link.attr('aria-label');
      const html = $link[0].outerHTML.slice(0, 120);

      if (!text && !ariaLabel) {
        cy.saveAuditResult({
          id: `link-empty-${Cypress._.uniqueId()}`,
          name: 'Empty link text',
          category: 'accessibility',
          severity: 'critical',
          status: 'fail',
          description: 'Links must have discernible text content',
          element: html,
          expected: 'Descriptive text or aria-label',
          actual: 'Empty link',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/link-purpose-in-context.html',
        });
        return;
      }

      const isGeneric = genericPhrases.includes(text);

      if (isGeneric && !ariaLabel) {
        cy.saveAuditResult({
          id: `link-generic-${Cypress._.uniqueId()}`,
          name: 'Generic link text',
          category: 'accessibility',
          severity: 'warning',
          status: 'fail',
          description: `Link text "${text}" is not descriptive enough`,
          element: html,
          expected: 'Descriptive link text that makes sense out of context',
          actual: `"${text}"`,
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/link-purpose-in-context.html',
        });
      }
    });
  });

  // ──────────────────────────────────────────────
  // CUSTOM CHECKS: DOCUMENT-LEVEL A11Y
  // ──────────────────────────────────────────────

  it('should have required document-level accessibility attributes', () => {
    // Check lang attribute
    cy.get('html').then(($html) => {
      const lang = $html.attr('lang');

      cy.saveAuditResult({
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
    });

    // Check document title
    cy.title().then((title) => {
      const isTooShort = !title || title.length < 5;

      cy.saveAuditResult({
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
  });

  // ──────────────────────────────────────────────
  // CUSTOM CHECKS: LINKS OPENING IN NEW TAB
  // ──────────────────────────────────────────────

  it('should warn users when links open in a new tab', () => {
    cy.get('a[target="_blank"]').each(($link) => {
      const text = $link.text().trim();
      const ariaLabel = $link.attr('aria-label') || '';
      const html = $link[0].outerHTML.slice(0, 150);
      const mentionsNewTab =
        text.includes('new tab') ||
        text.includes('new window') ||
        ariaLabel.includes('new tab') ||
        ariaLabel.includes('new window') ||
        $link.find('.sr-only, .visually-hidden').text().includes('new');

      cy.saveAuditResult({
        id: `link-newtab-${Cypress._.uniqueId()}`,
        name: 'New tab link warning',
        category: 'accessibility',
        severity: 'warning',
        status: mentionsNewTab ? 'pass' : 'fail',
        description:
          'Links that open in a new tab should indicate this to users',
        element: html,
        expected: 'Visual or SR-only indicator for target="_blank"',
        actual: mentionsNewTab ? 'Indicator found' : 'No indicator',
        helpUrl: 'https://www.w3.org/WAI/WCAG21/Techniques/general/G200',
      });
    });
  });
});

// ──────────────────────────────────────────────
// UTILITY FUNCTIONS
// ──────────────────────────────────────────────

function parseRgb(colorStr: string): [number, number, number] | null {
  const match = colorStr.match(
    /rgba?\((\d+),\s*(\d+),\s*(\d+)/
  );
  if (!match) return null;
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
}

function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRgb = c / 255;
    return sRgb <= 0.03928 ? sRgb / 12.92 : Math.pow((sRgb + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(
  fg: [number, number, number],
  bg: [number, number, number]
): number {
  const lum1 = getLuminance(...fg);
  const lum2 = getLuminance(...bg);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

function getEffectiveBackgroundColor(el: HTMLElement): string {
  let current: HTMLElement | null = el;

  while (current) {
    const bg = window.getComputedStyle(current).backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
      return bg;
    }
    current = current.parentElement;
  }

  // Default to white if no background found
  return 'rgb(255, 255, 255)';
}
