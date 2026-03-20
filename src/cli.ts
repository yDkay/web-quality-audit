#!/usr/bin/env node

import { Command } from 'commander';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { Category } from './types';

const program = new Command();

program
  .name('web-quality-audit')
  .description('Comprehensive website quality audit tool covering accessibility, SEO, and best practices')
  .version('1.0.0');

program
  .option('-u, --url <url>', 'Target URL to audit')
  .option(
    '-c, --category <categories...>',
    'Categories to audit (accessibility, seo, best-practices)',
  )
  .option('-f, --framework <framework>', 'Test framework to use (cypress, playwright)', 'cypress')
  .option('-o, --output <dir>', 'Output directory for reports', 'reports')
  .option('--config <path>', 'Path to config file', 'audit.config.ts')
  .option('--headed', 'Run in headed mode (visible browser)', false)
  .option('--browser <browser>', 'Browser to use (electron, chrome, firefox, edge)', 'electron')
  .action(async (options) => {
    console.log(chalk.bold.cyan('\n🔍 Web Quality Audit\n'));

    // Load config file if it exists
    let config: Record<string, unknown> = {};
    const configPath = path.resolve(options.config);

    if (fs.existsSync(configPath)) {
      console.log(chalk.gray(`Loading config from ${configPath}`));
      try {
        // For .ts configs, we rely on ts-node
        const loaded = require(configPath);
        config = loaded.default || loaded;
      } catch {
        console.log(chalk.yellow('Could not load config file, using CLI flags only'));
      }
    }

    // CLI flags override config
    const targetUrl = options.url || (config.url as string);

    if (!targetUrl) {
      console.error(chalk.red('Error: No target URL specified.'));
      console.error(chalk.gray('Use --url <url> or set url in audit.config.ts'));
      process.exit(1);
    }

    const validCategories: Category[] = ['accessibility', 'seo', 'best-practices'];
    const categories: Category[] = options.category || (config.categories as Category[]) || validCategories;

    // Validate framework
    const validFrameworks = ['cypress', 'playwright'];
    if (!validFrameworks.includes(options.framework)) {
      console.error(chalk.red(`Error: Invalid framework "${options.framework}"`));
      console.error(chalk.gray(`Valid frameworks: ${validFrameworks.join(', ')}`));
      process.exit(1);
    }

    // Validate categories
    for (const cat of categories) {
      if (!validCategories.includes(cat)) {
        console.error(chalk.red(`Error: Invalid category "${cat}"`));
        console.error(chalk.gray(`Valid categories: ${validCategories.join(', ')}`));
        process.exit(1);
      }
    }

    console.log(chalk.white(`  Target:     ${chalk.bold(targetUrl)}`));
    console.log(chalk.white(`  Framework:  ${chalk.bold(options.framework)}`));
    console.log(chalk.white(`  Categories: ${chalk.bold(categories.join(', '))}`));
    console.log(chalk.white(`  Browser:    ${chalk.bold(options.browser)}`));
    console.log(chalk.white(`  Output:     ${chalk.bold(options.output)}`));
    console.log('');

    // Ensure output directory exists
    const outputDir = path.resolve(options.output);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Clear previous audit data so results from old runs don't bleed in
    const dataDir = path.join(outputDir, 'data');
    if (fs.existsSync(dataDir)) {
      const oldFiles = fs.readdirSync(dataDir).filter((f) => f.endsWith('.json'));
      oldFiles.forEach((f) => fs.unlinkSync(path.join(dataDir, f)));
    }

    // Run audit
    console.log(chalk.cyan('Running audit...\n'));

    let cmd: string;

    if (options.framework === 'playwright') {
      // Build Playwright command
      const grepPatterns = categories.map(
        (cat) => cat.charAt(0).toUpperCase() + cat.slice(1).replace(/-/g, ' ')
      );
      // Run all specs, Playwright filters by test.describe name aren't needed
      // since specs are already organized by category folder
      const testDirs = categories.map((cat) => `playwright/tests/${cat}/`).join(' ');

      cmd = [
        'npx playwright test',
        testDirs,
        options.headed ? '--headed' : '',
      ].filter(Boolean).join(' ');
    } else {
      // Build Cypress command
      const specPatterns = categories.map(
        (cat) => `cypress/e2e/${cat}/**/*.cy.ts`
      );
      const specArg = specPatterns.join(',');

      cmd = [
        'npx cypress run',
        `--config baseUrl=${targetUrl}`,
        `--spec "${specArg}"`,
        `--browser ${options.browser}`,
        options.headed ? '--headed' : '--headless',
      ].join(' ');
    }

    try {
      execSync(cmd, {
        stdio: 'inherit',
        env: {
          ...process.env,
          AUDIT_OUTPUT_DIR: outputDir,
          AUDIT_URL: targetUrl,
        },
      });

      console.log(chalk.green('\n✅ Audit complete!'));
      console.log(chalk.gray(`Results saved to ${outputDir}/data/`));

      // Generate HTML report
      console.log(chalk.cyan('\nGenerating HTML report...'));

      execSync('npx ts-node src/reporter/generate.ts', {
        stdio: 'inherit',
        env: {
          ...process.env,
          AUDIT_OUTPUT_DIR: outputDir,
        },
      });
    } catch (error) {
      // Frameworks exit with non-zero on test failures, which is expected
      console.log(chalk.yellow('\n⚠️  Audit found issues (this is expected behavior)'));
      console.log(chalk.gray(`Results saved to ${outputDir}/data/`));

      // Still try to generate report
      try {
        execSync('npx ts-node src/reporter/generate.ts', {
          stdio: 'inherit',
          env: {
            ...process.env,
            AUDIT_OUTPUT_DIR: outputDir,
          },
        });
      } catch {
        console.log(chalk.gray('Report generation skipped'));
      }
    }
  });

program.parse();
