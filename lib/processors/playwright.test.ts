// Unit tests for PlaywrightProcessor

import { describe, it, expect } from 'vitest';
import { PlaywrightProcessor } from './playwright';
import playwrightFixture from '@/test-data/playwright.json';

describe('PlaywrightProcessor', () => {
  const processor = new PlaywrightProcessor();

  describe('detectFramework', () => {
    it('should detect Playwright framework from config.configFile', () => {
      const artifact = {
        config: {
          configFile: '/path/to/playwright.config.ts',
        },
      };
      expect(processor.detectFramework(artifact)).toBe(true);
    });

    it('should detect Playwright framework from config.rootDir', () => {
      const artifact = {
        config: {
          rootDir: '/path/to/project',
        },
      };
      expect(processor.detectFramework(artifact)).toBe(true);
    });

    it('should not detect Playwright without config', () => {
      const artifact = {
        stats: { tests: 100 },
      };
      expect(processor.detectFramework(artifact)).toBe(false);
    });

    it('should detect real Playwright fixture', () => {
      expect(processor.detectFramework(playwrightFixture)).toBe(true);
    });
  });

  describe('extractVersion', () => {
    it('should extract version from artifact metadata', () => {
      const artifact = {
        config: {
          version: '1.40.0',
        },
      };
      expect(processor.extractVersion(artifact)).toBe('1.40.0');
    });

    it('should return null if version not present', () => {
      const artifact = {
        config: {},
      };
      expect(processor.extractVersion(artifact)).toBeNull();
    });
  });

  describe('parseResults', () => {
    it('should return empty array for artifact without suites', () => {
      const artifact = {
        config: { configFile: 'test.ts' },
      };
      const results = processor.parseResults(artifact);
      expect(results).toEqual([]);
    });

    it('should parse test results from Playwright fixture', () => {
      const results = processor.parseResults(playwrightFixture);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('testTitle');
      expect(results[0]).toHaveProperty('fullTitle');
      expect(results[0]).toHaveProperty('status');
      expect(results[0]).toHaveProperty('duration');
      expect(results[0]).toHaveProperty('filePath');
    });

    it('should include error messages for failed tests', () => {
      const results = processor.parseResults(playwrightFixture);
      const failedTests = results.filter((r) => r.status === 'failed');

      if (failedTests.length > 0) {
        expect(failedTests[0].errorMessage).toBeDefined();
      }
    });
  });

  describe('getSummaryStats', () => {
    it('should return summary statistics', () => {
      const stats = processor.getSummaryStats(playwrightFixture);

      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('passed');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('skipped');
      expect(stats.total).toBeGreaterThan(0);
      expect(typeof stats.passed).toBe('number');
      expect(typeof stats.failed).toBe('number');
    });

    it('should have total equal to sum of statuses', () => {
      const stats = processor.getSummaryStats(playwrightFixture);
      const sum = stats.passed + stats.failed + (stats.skipped || 0) + (stats.timedOut || 0);

      expect(stats.total).toBe(sum);
    });
  });
});
