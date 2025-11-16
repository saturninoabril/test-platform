// Base processor interface for test framework parsers

export interface ProcessedTestResult {
  testTitle: string;
  fullTitle: string;
  status: string;
  duration: number;
  filePath: string;
  errorMessage?: string;
  // Framework-specific fields will be added by concrete implementations
  [key: string]: unknown;
}

export interface SummaryStats {
  total: number;
  passed: number;
  failed: number;
  skipped?: number;
  pending?: number;
  timedOut?: number;
}

export interface TimingInfo {
  startTime?: string | null;
  endTime?: string | null;
  wallClockDuration?: number | null; // in milliseconds
}

export abstract class BaseProcessor {
  /**
   * Detect if the artifact matches this processor's framework
   */
  abstract detectFramework(artifact: unknown): boolean;

  /**
   * Extract framework version from artifact metadata
   */
  abstract extractVersion(artifact: unknown): string | null;

  /**
   * Parse test results from the artifact
   */
  abstract parseResults(artifact: unknown): ProcessedTestResult[];

  /**
   * Get summary statistics from the artifact
   */
  abstract getSummaryStats(artifact: unknown): SummaryStats;

  /**
   * Extract timing information (start/end times and wall-clock duration)
   */
  abstract getTimingInfo(artifact: unknown): TimingInfo;
}
