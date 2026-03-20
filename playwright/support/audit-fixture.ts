import { test as base, Page, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import * as fs from 'fs';
import * as path from 'path';

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

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

// ──────────────────────────────────────────────
// AUDIT HELPERS (passed to tests via fixture)
// ──────────────────────────────────────────────

class AuditCollector {
  private results: AuditCheckInput[] = [];

  save(check: AuditCheckInput): void {
    this.results.push(check);
    const icon = check.status === 'pass' ? '✅' : check.status === 'fail' ? '❌' : '⚠️';
    console.log(`  ${icon} [${check.category}] ${check.name}: ${check.status}`);
  }

  getResults(): AuditCheckInput[] {
    return [...this.results];
  }

  flush(baseUrl: string): void {
    if (this.results.length === 0) return;

    const outputDir = path.join(process.cwd(), 'reports', 'data');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.json`;
    fs.writeFileSync(
      path.join(outputDir, filename),
      JSON.stringify(
        {
          url: baseUrl,
          timestamp: new Date().toISOString(),
          framework: 'playwright',
          checks: this.results,
        },
        null,
        2
      )
    );

    console.log(`\n  💾 Saved ${this.results.length} checks to ${filename}`);

    // Clear results so they aren't duplicated in the next spec file's flush.
    // The collector is a module-level singleton shared across all spec files
    // when running with workers: 1.
    this.results = [];
  }
}

// ──────────────────────────────────────────────
// PAGE HELPERS (utility functions for tests)
// ──────────────────────────────────────────────

class AuditHelpers {
  constructor(private page: Page) {}

  /**
   * Run axe-core accessibility analysis
   */
  async runAxe(tags: string[] = ['wcag2a', 'wcag2aa', 'wcag21aa']) {
    const results = await new AxeBuilder({ page: this.page })
      .withTags(tags)
      .analyze();
    return results;
  }

  /**
   * Get computed style of an element
   */
  async getComputedStyle(selector: string, property: string): Promise<string> {
    return this.page.evaluate(
      ({ sel, prop }) => {
        const el = document.querySelector(sel);
        if (!el) return '';
        return window.getComputedStyle(el).getPropertyValue(prop);
      },
      { sel: selector, prop: property }
    );
  }

  /**
   * Get effective background color walking up the DOM tree
   */
  async getEffectiveBackground(element: string): Promise<string> {
    return this.page.evaluate((selector) => {
      let current: HTMLElement | null = document.querySelector(selector);
      while (current) {
        const bg = window.getComputedStyle(current).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          return bg;
        }
        current = current.parentElement;
      }
      return 'rgb(255, 255, 255)';
    }, element);
  }

  /**
   * Capture responsive screenshots at multiple viewports
   */
  async captureResponsiveScreenshots(
    viewports: ViewportDef[] = [
      { name: 'mobile', width: 375, height: 812 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1280, height: 720 },
    ]
  ): Promise<void> {
    const screenshotDir = path.join(process.cwd(), 'reports', 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    for (const vp of viewports) {
      await this.page.setViewportSize({ width: vp.width, height: vp.height });
      await this.page.waitForTimeout(500); // Layout reflow
      await this.page.screenshot({
        path: path.join(screenshotDir, `responsive-${vp.name}-${vp.width}x${vp.height}.png`),
        fullPage: true,
      });
    }
  }
}

// ──────────────────────────────────────────────
// CONTRAST UTILITIES (exported for test use)
// ──────────────────────────────────────────────

export function parseRgb(colorStr: string): [number, number, number] | null {
  const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
}

export function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRgb = c / 255;
    return sRgb <= 0.03928 ? sRgb / 12.92 : Math.pow((sRgb + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function getContrastRatio(
  fg: [number, number, number],
  bg: [number, number, number]
): number {
  const lum1 = getLuminance(...fg);
  const lum2 = getLuminance(...bg);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ──────────────────────────────────────────────
// CUSTOM TEST FIXTURE
// ──────────────────────────────────────────────

type AuditFixtures = {
  helpers: AuditHelpers;
};

export const test = base.extend<AuditFixtures>({
  helpers: async ({ page }, use) => {
    await use(new AuditHelpers(page));
  },
});

/**
 * Create a collector instance for a spec file.
 * Call this at the top of each spec, then use test.afterAll to flush.
 *
 * Usage:
 *   const audit = createAuditCollector();
 *   test.afterAll(({ baseURL }) => { audit.flush(baseURL || 'unknown'); });
 *   test('my check', async ({ page }) => { audit.save({...}); });
 */
export function createAuditCollector(): AuditCollector {
  return new AuditCollector();
}

export { expect, AuditCollector };
