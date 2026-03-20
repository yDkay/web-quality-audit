import { AuditConfig } from './src/types';

const config: AuditConfig = {
  url: 'http://localhost:3939',

  categories: ['accessibility', 'seo', 'best-practices'],

  viewports: [
    { name: 'mobile', width: 375, height: 812 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1280, height: 720 },
  ],

  outputDir: 'reports',
  reportFormat: 'both',

  axeConfig: {
    runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'],
  },
};

export default config;
