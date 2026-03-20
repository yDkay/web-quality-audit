import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    fixturesFolder: 'cypress/fixtures',
    video: false,
    screenshotsFolder: 'reports/screenshots',
    defaultCommandTimeout: 10000,
    viewportWidth: 1280,
    viewportHeight: 720,
    setupNodeEvents(on, config) {
      on('task', {
        log(message: string) {
          console.log(message);
          return null;
        },
        saveAuditResults(results: Record<string, unknown>) {
          const fs = require('fs');
          const path = require('path');
          const outputDir = path.join(__dirname, 'reports', 'data');

          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }

          const filename = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.json`;
          fs.writeFileSync(
            path.join(outputDir, filename),
            JSON.stringify(results, null, 2)
          );

          return filename;
        },
      });

      return config;
    },
  },
});
