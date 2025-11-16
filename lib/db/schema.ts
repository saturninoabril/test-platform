import {
  timestamp,
  pgTable,
  text,
  varchar,
  primaryKey,
  integer,
  uuid,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import type { AdapterAccountType } from 'next-auth/adapters';

export const users = pgTable('user', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').notNull(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
});

export const accounts = pgTable(
  'account',
  {
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (table) => [primaryKey({ columns: [table.provider, table.providerAccountId] })]
);

export const sessions = pgTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable(
  'verificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })]
);

// Test Artifacts Schema - Stores raw test artifacts with GitHub Actions metadata
export const testArtifacts = pgTable(
  'test_artifacts',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Test framework identifier
    framework: text('framework').notNull(), // 'playwright', 'cypress', 'jest', etc.

    // Raw artifact JSON (complete test results from the framework)
    artifact: jsonb('artifact').notNull(),

    // Processing status and metadata (NEW FIELDS for background processing)
    processingStatus: text('processing_status').notNull().default('pending'), // 'pending', 'processing', 'processed', 'failed'
    processingError: text('processing_error'), // Error message if status = 'failed'
    frameworkVersion: text('framework_version'), // e.g., 'Playwright 1.40.0', 'Cypress 13.6.0'
    processedAt: timestamp('processed_at', { mode: 'date' }), // Timestamp when processing completed
    processingDurationMs: integer('processing_duration_ms'), // Time taken to process in milliseconds

    // GitHub Actions metadata
    githubRepository: text('github_repository'), // e.g., 'owner/repo'
    githubSha: text('github_sha'), // commit SHA
    githubHeadRef: text('github_head_ref'), // head branch for PR
    githubBaseRef: text('github_base_ref'), // base branch for PR
    githubRef: text('github_ref'), // full ref (e.g., 'refs/heads/main')
    githubActor: text('github_actor'), // user who triggered the workflow
    githubRunId: text('github_run_id'), // workflow run ID
    githubRunNumber: integer('github_run_number'), // workflow run number
    githubRunAttempt: integer('github_run_attempt'), // retry attempt number
    githubJob: text('github_job'), // job name
    runnerName: text('runner_name'), // runner machine name

    // Timestamps
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    // Index for querying by processing status
    index('idx_artifacts_processing_status').on(table.processingStatus),
  ]
);

// Playwright Test Results Schema - Stores individual test results from Playwright framework
export const playwrightTestResults = pgTable(
  'playwright_test_results',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    artifactId: uuid('artifact_id')
      .notNull()
      .references(() => testArtifacts.id, { onDelete: 'cascade' }),

    testTitle: varchar('test_title', { length: 500 }).notNull(),
    fullTitle: varchar('full_title', { length: 1000 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(), // 'passed', 'failed', 'skipped', 'timedOut'
    duration: integer('duration').notNull(), // Duration in milliseconds
    filePath: varchar('file_path', { length: 1000 }).notNull(),

    projectName: varchar('project_name', { length: 255 }),
    retryAttempt: integer('retry_attempt').notNull().default(0),
    errorMessage: varchar('error_message', { length: 5000 }),
    errorStack: text('error_stack'), // Keep as text since 10000 is large
    browser: varchar('browser', { length: 100 }),

    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_playwright_artifact_created').on(table.artifactId, table.createdAt.desc()),
    index('idx_playwright_artifact_status').on(table.artifactId, table.status),
  ]
);

// Cypress Test Results Schema - Stores individual test results from Cypress framework
export const cypressTestResults = pgTable(
  'cypress_test_results',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    artifactId: uuid('artifact_id')
      .notNull()
      .references(() => testArtifacts.id, { onDelete: 'cascade' }),

    testUuid: varchar('test_uuid', { length: 100 }).notNull(),
    testTitle: varchar('test_title', { length: 500 }).notNull(),
    fullTitle: varchar('full_title', { length: 1000 }).notNull(),
    state: varchar('state', { length: 20 }).notNull(), // 'passed', 'failed', 'pending'
    duration: integer('duration').notNull(), // Duration in milliseconds
    specFile: varchar('spec_file', { length: 1000 }).notNull(),

    suiteUuid: varchar('suite_uuid', { length: 100 }),
    parentUuid: varchar('parent_uuid', { length: 100 }),
    code: text('code'), // Keep as text since 10000 is large
    errorMessage: varchar('error_message', { length: 5000 }),
    errorName: varchar('error_name', { length: 255 }),
    speed: varchar('speed', { length: 20 }),

    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_cypress_artifact_created').on(table.artifactId, table.createdAt.desc()),
    index('idx_cypress_artifact_state').on(table.artifactId, table.state),
    index('idx_cypress_test_uuid').on(table.testUuid),
  ]
);

// API Events Schema - Stores all API interaction logs for audit and analytics
export const apiEvents = pgTable(
  'api_events',
  {
    // Primary identifier
    id: uuid('id').defaultRandom().primaryKey(),

    // Request metadata
    method: text('method').notNull(), // GET, POST, PUT, DELETE, PATCH, etc.
    endpoint: text('endpoint').notNull(), // Full path: /api/test-reports, /api/events/:id

    // Response metadata
    statusCode: integer('status_code').notNull(), // 200, 400, 401, 500, etc.

    // Timing information
    requestTimestamp: timestamp('request_timestamp', { mode: 'date' }).notNull(),
    responseTimestamp: timestamp('response_timestamp', { mode: 'date' }).notNull(),
    durationMs: integer('duration_ms').notNull(), // Response time in milliseconds

    // Authentication
    authenticationStatus: text('authentication_status').notNull(),
    // Values: 'authenticated', 'unauthenticated', 'auth_failed'
    maskedJWTToken: text('masked_jwt_token'), // Masked JWT token: "eyJ...[SIGNATURE_HIDDEN]"
    jwtSubject: text('jwt_subject'), // JWT subject (e.g., "ci-service", "user-123")
    jwtRoles: text('jwt_roles'), // Comma-separated JWT roles (e.g., "admin,read:events")

    // Source identification
    sourceIdentifier: text('source_identifier'), // IP address or client ID

    // Error information (if applicable)
    errorType: text('error_type'), // Error class name or NULL
    errorMessage: text('error_message'), // Error message or NULL

    // Payload data (request/response bodies)
    requestPayload: jsonb('request_payload'), // Request body (JSON only, up to max size limit)
    responsePayload: jsonb('response_payload'), // Response body (up to max size limit)
    requestPayloadSize: integer('request_payload_size'), // Original request size in bytes
    responsePayloadSize: integer('response_payload_size'), // Original response size in bytes
    payloadTruncated: text('payload_truncated'), // 'request', 'response', 'both', or NULL

    // Additional context (flexible JSONB for extensibility)
    context: jsonb('context'),

    // Audit timestamps
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    // Indexes for query performance
    index('idx_api_events_created_at').on(table.createdAt.desc()),
    index('idx_api_events_endpoint_created_at').on(table.endpoint, table.createdAt.desc()),
    index('idx_api_events_status_created_at').on(table.statusCode, table.createdAt.desc()),
    index('idx_api_events_method_created_at').on(table.method, table.createdAt.desc()),
  ]
);
