import 'server-only';

/**
 * Repository Layer Barrel Export
 *
 * This file serves as the main entry point for all repository instances.
 * Import repositories from this file rather than directly from their modules.
 *
 * Example usage:
 *   import { testArtifactsRepository } from '@/lib/db/repositories';
 */

// Export types
export type {
  DrizzleTransaction,
  DatabaseOrTransaction,
  UserContext,
  PaginationParams,
  PaginatedResult,
} from './types';

// Export error classes
export {
  ApplicationError,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
  transformDatabaseError,
} from '../../errors/database-errors';

// Repository instances
export { testArtifactsRepository } from './test-artifacts.repository';
export type {
  CreateTestArtifactInput,
  ListTestArtifactsInput,
  UpdateProcessingStatusInput,
  TestArtifactDTO,
  TestArtifactWithArtifactDTO,
  TestSummary,
} from './test-artifacts.repository';

export { apiEventsRepository } from './api-events.repository';
export type { CreateApiEventInput, ListApiEventsInput, ApiEventDTO } from './api-events.repository';

export { playwrightTestResultsRepository } from './playwright-test-results.repository';
export type {
  CreatePlaywrightTestResultInput,
  ListPlaywrightTestResultsInput,
  PlaywrightTestResultDTO,
} from './playwright-test-results.repository';

export { cypressTestResultsRepository } from './cypress-test-results.repository';
export type {
  CreateCypressTestResultInput,
  ListCypressTestResultsInput,
  CypressTestResultDTO,
} from './cypress-test-results.repository';
