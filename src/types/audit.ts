export type Severity = 'critical' | 'warning' | 'info';
export type Status = 'pass' | 'fail' | 'warning';
export type Category = 'accessibility' | 'seo' | 'best-practices';

export interface AuditCheck {
  id: string;
  name: string;
  category: Category;
  severity: Severity;
  status: Status;
  description: string;
  details?: string;
  element?: string;
  expected?: string;
  actual?: string;
  helpUrl?: string;
}

export interface CategorySummary {
  category: Category;
  total: number;
  passed: number;
  failed: number;
  warnings: number;
  score: number; // 0-100
}

export interface AuditReport {
  url: string;
  timestamp: string;
  duration: number;
  framework: 'cypress' | 'playwright';
  categories: CategorySummary[];
  checks: AuditCheck[];
  screenshots?: ScreenshotEntry[];
}

export interface ScreenshotEntry {
  name: string;
  path: string;
  viewport: string;
}

export interface AuditConfig {
  url: string;
  categories?: Category[];
  viewports?: ViewportConfig[];
  outputDir?: string;
  reportFormat?: 'html' | 'json' | 'both';
  axeConfig?: {
    runOnly?: string[];
    rules?: Record<string, { enabled: boolean }>;
  };
}

export interface ViewportConfig {
  name: string;
  width: number;
  height: number;
}

export const DEFAULT_VIEWPORTS: ViewportConfig[] = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 720 },
];

export const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 10,
  warning: 5,
  info: 1,
};
