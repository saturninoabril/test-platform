// Unit tests for processor factory and framework detection

import { describe, it, expect } from 'vitest';
import { getProcessor, detectFrameworkType } from './index';
import { PlaywrightProcessor } from './playwright';
import { CypressProcessor } from './cypress';

describe('getProcessor', () => {
  it('should return PlaywrightProcessor for Playwright artifacts', () => {
    const artifact = {
      config: {
        configFile: '/path/to/playwright.config.ts',
      },
    };

    const processor = getProcessor(artifact);
    expect(processor).toBeInstanceOf(PlaywrightProcessor);
  });

  it('should return CypressProcessor for Cypress artifacts', () => {
    const artifact = {
      stats: {
        suites: 10,
        tests: 50,
      },
    };

    const processor = getProcessor(artifact);
    expect(processor).toBeInstanceOf(CypressProcessor);
  });

  it('should throw error for unknown framework', () => {
    const artifact = {
      someOtherProperty: 'value',
    };

    expect(() => getProcessor(artifact)).toThrow(
      'Unknown framework: artifact does not match any supported framework'
    );
  });

  it('should throw error for null artifact', () => {
    expect(() => getProcessor(null)).toThrow('Unknown framework');
  });

  it('should throw error for undefined artifact', () => {
    expect(() => getProcessor(undefined)).toThrow('Unknown framework');
  });
});

describe('detectFrameworkType', () => {
  describe('Playwright detection', () => {
    it('should detect Playwright from config.configFile', () => {
      const artifact = {
        config: {
          configFile: '/path/to/playwright.config.ts',
        },
      };

      expect(detectFrameworkType(artifact)).toBe('playwright');
    });

    it('should detect Playwright from config.rootDir', () => {
      const artifact = {
        config: {
          rootDir: '/path/to/project',
        },
      };

      expect(detectFrameworkType(artifact)).toBe('playwright');
    });

    it('should detect Playwright when both configFile and rootDir exist', () => {
      const artifact = {
        config: {
          configFile: '/path/to/playwright.config.ts',
          rootDir: '/path/to/project',
        },
      };

      expect(detectFrameworkType(artifact)).toBe('playwright');
    });
  });

  describe('Cypress detection', () => {
    it('should detect Cypress from stats.suites and stats.tests', () => {
      const artifact = {
        stats: {
          suites: 10,
          tests: 50,
        },
      };

      expect(detectFrameworkType(artifact)).toBe('cypress');
    });

    it('should detect Cypress with zero suites and tests', () => {
      const artifact = {
        stats: {
          suites: 0,
          tests: 0,
        },
      };

      expect(detectFrameworkType(artifact)).toBe('cypress');
    });

    it('should not detect Cypress if stats.suites is not a number', () => {
      const artifact = {
        stats: {
          suites: 'invalid',
          tests: 50,
        },
      };

      expect(detectFrameworkType(artifact)).toBe('unknown');
    });

    it('should not detect Cypress if stats.tests is not a number', () => {
      const artifact = {
        stats: {
          suites: 10,
          tests: 'invalid',
        },
      };

      expect(detectFrameworkType(artifact)).toBe('unknown');
    });

    it('should not detect Cypress if stats is missing', () => {
      const artifact = {
        config: {},
      };

      expect(detectFrameworkType(artifact)).toBe('unknown');
    });
  });

  describe('Unknown framework detection', () => {
    it('should return unknown for empty object', () => {
      expect(detectFrameworkType({})).toBe('unknown');
    });

    it('should return unknown for null', () => {
      expect(detectFrameworkType(null)).toBe('unknown');
    });

    it('should return unknown for undefined', () => {
      expect(detectFrameworkType(undefined)).toBe('unknown');
    });

    it('should return unknown for unrecognized structure', () => {
      const artifact = {
        someOtherProperty: 'value',
        anotherProperty: 123,
      };

      expect(detectFrameworkType(artifact)).toBe('unknown');
    });

    it('should return unknown when only config exists without required fields', () => {
      const artifact = {
        config: {
          someOtherField: 'value',
        },
      };

      expect(detectFrameworkType(artifact)).toBe('unknown');
    });
  });
});
