import './commands';

// Prevent uncaught exceptions from the application under test from failing Cypress.
// The demo page intentionally throws errors (e.g. undefinedFunction()) to test
// console error detection. We catch them here so they don't abort the suite.
Cypress.on('uncaught:exception', (_err, _runnable) => {
  // Return false to prevent Cypress from failing the test
  return false;
});
