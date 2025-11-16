// Unit tests for CypressProcessor

import { describe, it, expect } from 'vitest';
import { CypressProcessor } from './cypress';
import cypressFixture from '@/test-data/cypress.json';

describe('CypressProcessor', () => {
  const processor = new CypressProcessor();

  describe('detectFramework', () => {
    it('should detect Cypress framework from stats.suites', () => {
      const artifact = {
        stats: {
          suites: 520,
          tests: 1639,
        },
      };
      expect(processor.detectFramework(artifact)).toBe(true);
    });

    it('should detect Cypress framework from stats.tests', () => {
      const artifact = {
        stats: {
          suites: 100,
          tests: 500,
        },
      };
      expect(processor.detectFramework(artifact)).toBe(true);
    });

    it('should not detect Cypress without stats', () => {
      const artifact = {
        results: [],
      };
      expect(processor.detectFramework(artifact)).toBe(false);
    });

    it('should not detect Cypress with invalid stats', () => {
      const artifact = {
        stats: {
          suites: 'invalid',
          tests: 'invalid',
        },
      };
      expect(processor.detectFramework(artifact)).toBe(false);
    });

    it('should detect real Cypress fixture', () => {
      expect(processor.detectFramework(cypressFixture)).toBe(true);
    });
  });

  describe('extractVersion', () => {
    it('should extract version from artifact metadata', () => {
      const artifact = {
        config: {
          version: '13.6.0',
        },
        stats: {
          suites: 1,
          tests: 1,
        },
      };
      expect(processor.extractVersion(artifact)).toBe('13.6.0');
    });

    it('should return null if version not present', () => {
      const artifact = {
        stats: {
          suites: 1,
          tests: 1,
        },
      };
      expect(processor.extractVersion(artifact)).toBeNull();
    });

    it('should return null if config is empty', () => {
      const artifact = {
        config: {},
        stats: {
          suites: 1,
          tests: 1,
        },
      };
      expect(processor.extractVersion(artifact)).toBeNull();
    });
  });

  describe('parseResults', () => {
    it('should return empty array for artifact without results', () => {
      const artifact = {
        stats: {
          suites: 0,
          tests: 0,
        },
      };
      const results = processor.parseResults(artifact);
      expect(results).toEqual([]);
    });

    it('should parse test results from Cypress fixture', () => {
      const results = processor.parseResults(cypressFixture);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('testTitle');
      expect(results[0]).toHaveProperty('fullTitle');
      expect(results[0]).toHaveProperty('status');
      expect(results[0]).toHaveProperty('duration');
      expect(results[0]).toHaveProperty('filePath');
    });

    it('should include Cypress-specific fields', () => {
      const results = processor.parseResults(cypressFixture);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('testUuid');
      expect(results[0]).toHaveProperty('suiteUuid');
      expect(results[0]).toHaveProperty('parentUuid');
      expect(results[0]).toHaveProperty('code');
    });

    it('should include error messages for failed tests', () => {
      const results = processor.parseResults(cypressFixture);
      const failedTests = results.filter((r) => r.status === 'failed');

      if (failedTests.length > 0) {
        expect(failedTests[0].errorMessage).toBeDefined();
      }
    });

    it('should skip hooks in test results', () => {
      const artifact = {
        stats: { suites: 1, tests: 2 },
        results: [
          {
            file: 'test.spec.js',
            suites: [
              {
                uuid: 'suite-1',
                title: 'Test Suite',
                tests: [
                  {
                    title: 'Real Test',
                    fullTitle: 'Test Suite Real Test',
                    duration: 100,
                    state: 'passed',
                    pass: true,
                    fail: false,
                    pending: false,
                    uuid: 'test-1',
                    parentUUID: 'suite-1',
                    isHook: false,
                    skipped: false,
                    timedOut: null,
                  },
                  {
                    title: 'before hook',
                    fullTitle: 'Test Suite before hook',
                    duration: 10,
                    state: 'passed',
                    pass: true,
                    fail: false,
                    pending: false,
                    uuid: 'hook-1',
                    parentUUID: 'suite-1',
                    isHook: true, // Should be skipped
                    skipped: false,
                    timedOut: null,
                  },
                ],
              },
            ],
          },
        ],
      };

      const results = processor.parseResults(artifact);
      expect(results.length).toBe(1);
      expect(results[0].testTitle).toBe('Real Test');
    });

    it('should handle nested suites recursively', () => {
      const artifact = {
        stats: { suites: 2, tests: 2 },
        results: [
          {
            file: 'test.spec.js',
            suites: [
              {
                uuid: 'suite-1',
                title: 'Parent Suite',
                tests: [
                  {
                    title: 'Test 1',
                    fullTitle: 'Parent Suite Test 1',
                    duration: 100,
                    state: 'passed',
                    pass: true,
                    fail: false,
                    pending: false,
                    uuid: 'test-1',
                    parentUUID: 'suite-1',
                    isHook: false,
                    skipped: false,
                    timedOut: null,
                  },
                ],
                suites: [
                  {
                    uuid: 'suite-2',
                    title: 'Nested Suite',
                    tests: [
                      {
                        title: 'Test 2',
                        fullTitle: 'Parent Suite Nested Suite Test 2',
                        duration: 150,
                        state: 'failed',
                        pass: false,
                        fail: true,
                        pending: false,
                        uuid: 'test-2',
                        parentUUID: 'suite-2',
                        isHook: false,
                        skipped: false,
                        timedOut: null,
                        err: {
                          message: 'Expected true to be false',
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      const results = processor.parseResults(artifact);
      expect(results.length).toBe(2);
      expect(results[0].testTitle).toBe('Test 1');
      expect(results[1].testTitle).toBe('Test 2');
      expect(results[1].errorMessage).toBe('Expected true to be false');
    });
  });

  describe('getSummaryStats', () => {
    it('should return summary statistics', () => {
      const stats = processor.getSummaryStats(cypressFixture);

      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('passed');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('pending');
      expect(stats.total).toBeGreaterThan(0);
      expect(typeof stats.passed).toBe('number');
      expect(typeof stats.failed).toBe('number');
    });

    it('should use stats from Cypress artifact', () => {
      const stats = processor.getSummaryStats(cypressFixture);

      // Cypress fixture has these stats
      expect(stats.total).toBe(1639);
      expect(stats.passed).toBe(1525);
      expect(stats.failed).toBe(95);
      expect(stats.pending).toBe(19);
    });

    it('should have total equal to sum of statuses', () => {
      const stats = processor.getSummaryStats(cypressFixture);
      const sum = stats.passed + stats.failed + (stats.pending || 0);

      expect(stats.total).toBe(sum);
    });

    it('should handle missing stats gracefully', () => {
      const artifact = {
        stats: {},
        results: [],
      };
      const stats = processor.getSummaryStats(artifact);

      expect(stats.total).toBe(0);
      expect(stats.passed).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.pending).toBe(0);
    });
  });
});
