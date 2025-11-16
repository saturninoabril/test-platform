// Unit tests for processArtifact job
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { processArtifact, triggerProcessing } from './process-artifact';
import * as processorModule from '@/lib/processors';
import type { ProcessedTestResult } from '@/lib/processors/base';

// Mock repositories module
vi.mock('@/lib/db/repositories', () => ({
  testArtifactsRepository: {
    getArtifactByIdWithArtifact: vi.fn(),
    updateProcessingStatus: vi.fn(),
  },
  playwrightTestResultsRepository: {
    createTestResults: vi.fn(),
  },
  cypressTestResultsRepository: {
    createTestResults: vi.fn(),
  },
}));

// Mock processors module
vi.mock('@/lib/processors', () => ({
  getProcessor: vi.fn(),
  detectFrameworkType: vi.fn(),
}));

// Import mocked repositories at top level
import {
  testArtifactsRepository,
  playwrightTestResultsRepository,
  cypressTestResultsRepository,
} from '@/lib/db/repositories';

describe('processArtifact', () => {
  const mockArtifactId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw error if artifact not found', async () => {
    // Mock repository returning null for not found
    vi.mocked(testArtifactsRepository.getArtifactByIdWithArtifact).mockResolvedValue(null);

    await expect(processArtifact(mockArtifactId)).rejects.toThrow(
      `Artifact not found: ${mockArtifactId}`
    );
  });

  it('should update status to processing at start', async () => {
    const mockArtifact: any = {
      id: mockArtifactId,
      framework: 'playwright',
      artifact: { config: { configFile: 'test.config.ts' } },
    };

    vi.mocked(testArtifactsRepository.getArtifactByIdWithArtifact).mockResolvedValue(mockArtifact);
    vi.mocked(testArtifactsRepository.updateProcessingStatus).mockResolvedValue({} as any);
    vi.mocked(processorModule.detectFrameworkType).mockReturnValue('playwright');
    vi.mocked(processorModule.getProcessor).mockReturnValue({
      detectFramework: vi.fn().mockReturnValue(true),
      extractVersion: vi.fn().mockReturnValue('1.40.0'),
      parseResults: vi.fn().mockReturnValue([]),
      getSummaryStats: vi.fn().mockReturnValue({ total: 0, passed: 0, failed: 0 }),
      getTimingInfo: vi.fn().mockReturnValue({}),
    } as any);
    vi.mocked(playwrightTestResultsRepository.createTestResults).mockResolvedValue([]);

    await processArtifact(mockArtifactId);

    expect(testArtifactsRepository.updateProcessingStatus).toHaveBeenCalledWith(
      mockArtifactId,
      'processing'
    );
  });

  it('should detect Playwright framework and insert results', async () => {
    const mockArtifact: any = {
      id: mockArtifactId,
      framework: 'playwright',
      artifact: { config: { configFile: 'test.config.ts' }, suites: [] },
    };

    const mockTestResults: ProcessedTestResult[] = [
      {
        testTitle: 'Test 1',
        fullTitle: 'Suite Test 1',
        status: 'passed',
        duration: 100,
        filePath: 'test.spec.ts',
        projectName: 'chromium',
        retryAttempt: 0,
      },
    ];

    vi.mocked(testArtifactsRepository.getArtifactByIdWithArtifact).mockResolvedValue(mockArtifact);
    vi.mocked(testArtifactsRepository.updateProcessingStatus).mockResolvedValue({} as any);
    vi.mocked(processorModule.detectFrameworkType).mockReturnValue('playwright');
    vi.mocked(processorModule.getProcessor).mockReturnValue({
      detectFramework: vi.fn().mockReturnValue(true),
      extractVersion: vi.fn().mockReturnValue('1.40.0'),
      parseResults: vi.fn().mockReturnValue(mockTestResults),
      getSummaryStats: vi.fn().mockReturnValue({ total: 1, passed: 1, failed: 0 }),
      getTimingInfo: vi.fn().mockReturnValue({}),
    } as any);
    vi.mocked(playwrightTestResultsRepository.createTestResults).mockResolvedValue([{} as any]);

    await processArtifact(mockArtifactId);

    expect(playwrightTestResultsRepository.createTestResults).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          artifactId: mockArtifactId,
          testTitle: 'Test 1',
        }),
      ])
    );
  });

  it('should detect Cypress framework and insert results', async () => {
    const mockArtifact: any = {
      id: mockArtifactId,
      framework: 'cypress',
      artifact: { stats: {} },
    };

    const mockTestResults: ProcessedTestResult[] = [
      {
        testTitle: 'Test 1',
        fullTitle: 'Suite Test 1',
        status: 'passed',
        duration: 100,
        filePath: 'test.cy.js',
      },
    ];

    vi.mocked(testArtifactsRepository.getArtifactByIdWithArtifact).mockResolvedValue(mockArtifact);
    vi.mocked(testArtifactsRepository.updateProcessingStatus).mockResolvedValue({} as any);
    vi.mocked(processorModule.detectFrameworkType).mockReturnValue('cypress');
    vi.mocked(processorModule.getProcessor).mockReturnValue({
      detectFramework: vi.fn().mockReturnValue(true),
      extractVersion: vi.fn().mockReturnValue('13.6.0'),
      parseResults: vi.fn().mockReturnValue(mockTestResults),
      getSummaryStats: vi.fn().mockReturnValue({ total: 1, passed: 1, failed: 0 }),
      getTimingInfo: vi.fn().mockReturnValue({}),
    } as any);
    vi.mocked(cypressTestResultsRepository.createTestResults).mockResolvedValue([{} as any]);

    await processArtifact(mockArtifactId);

    expect(cypressTestResultsRepository.createTestResults).toHaveBeenCalled();
  });

  it('should handle unknown framework and update status to failed', async () => {
    const mockArtifact: any = {
      id: mockArtifactId,
      framework: 'unknown',
      artifact: {},
    };

    vi.mocked(testArtifactsRepository.getArtifactByIdWithArtifact).mockResolvedValue(mockArtifact);
    vi.mocked(testArtifactsRepository.updateProcessingStatus).mockResolvedValue({} as any);
    vi.mocked(processorModule.detectFrameworkType).mockReturnValue('unknown');

    await expect(processArtifact(mockArtifactId)).rejects.toThrow('Unable to detect framework');

    // Should be called with 'failed', not 'processing_failed'
    expect(testArtifactsRepository.updateProcessingStatus).toHaveBeenLastCalledWith(
      mockArtifactId,
      'failed',
      expect.objectContaining({
        error: expect.stringContaining('Unable to detect framework'),
      })
    );
  });

  it('should update artifact with success status and metadata after processing', async () => {
    const mockArtifact: any = {
      id: mockArtifactId,
      framework: 'playwright',
      artifact: { config: {} },
    };

    vi.mocked(testArtifactsRepository.getArtifactByIdWithArtifact).mockResolvedValue(mockArtifact);
    vi.mocked(testArtifactsRepository.updateProcessingStatus).mockResolvedValue({} as any);
    vi.mocked(processorModule.detectFrameworkType).mockReturnValue('playwright');
    vi.mocked(processorModule.getProcessor).mockReturnValue({
      detectFramework: vi.fn().mockReturnValue(true),
      extractVersion: vi.fn().mockReturnValue('1.40.0'),
      parseResults: vi.fn().mockReturnValue([]),
      getSummaryStats: vi.fn().mockReturnValue({ total: 0, passed: 0, failed: 0 }),
      getTimingInfo: vi.fn().mockReturnValue({}),
    } as any);
    vi.mocked(playwrightTestResultsRepository.createTestResults).mockResolvedValue([]);

    await processArtifact(mockArtifactId);

    expect(testArtifactsRepository.updateProcessingStatus).toHaveBeenLastCalledWith(
      mockArtifactId,
      'processed',
      expect.objectContaining({
        frameworkVersion: '1.40.0',
      })
    );
  });

  it('should handle empty test results gracefully', async () => {
    const mockArtifact: any = {
      id: mockArtifactId,
      framework: 'playwright',
      artifact: { suites: [] },
    };

    vi.mocked(testArtifactsRepository.getArtifactByIdWithArtifact).mockResolvedValue(mockArtifact);
    vi.mocked(testArtifactsRepository.updateProcessingStatus).mockResolvedValue({} as any);
    vi.mocked(processorModule.detectFrameworkType).mockReturnValue('playwright');
    vi.mocked(processorModule.getProcessor).mockReturnValue({
      detectFramework: vi.fn().mockReturnValue(true),
      extractVersion: vi.fn().mockReturnValue('1.40.0'),
      parseResults: vi.fn().mockReturnValue([]),
      getSummaryStats: vi.fn().mockReturnValue({ total: 0, passed: 0, failed: 0 }),
      getTimingInfo: vi.fn().mockReturnValue({}),
    } as any);
    vi.mocked(playwrightTestResultsRepository.createTestResults).mockResolvedValue([]);

    await processArtifact(mockArtifactId);

    // When results are empty, createTestResults is NOT called (optimization)
    expect(playwrightTestResultsRepository.createTestResults).not.toHaveBeenCalled();
    // But the artifact should still be marked as processed
    expect(testArtifactsRepository.updateProcessingStatus).toHaveBeenLastCalledWith(
      mockArtifactId,
      'processed',
      expect.any(Object)
    );
  });
});

describe('triggerProcessing', () => {
  it('should call processArtifact without awaiting', () => {
    const mockArtifactId = '123e4567-e89b-12d3-a456-426614174000';

    // Should not throw or await
    expect(() => triggerProcessing(mockArtifactId)).not.toThrow();
  });
});
