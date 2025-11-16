// API endpoint for fetching file-level test summaries for a specific artifact

import { NextRequest, NextResponse } from 'next/server';
// Complex aggregation queries with FILTER clauses require direct database access
// eslint-disable-next-line no-restricted-imports
import { db } from '@/lib/db';
// eslint-disable-next-line no-restricted-imports
import { playwrightTestResults, cypressTestResults } from '@/lib/db/schema';
import { withEventLogging } from '@/lib/events/with-logging';
import { sql } from 'drizzle-orm';
import { detectFrameworkType } from '@/lib/processors';
import { testArtifactsRepository, ApplicationError, NotFoundError } from '@/lib/db/repositories';

async function handleGET(
  request: NextRequest,
  context?: { params?: Promise<{ artifactId: string }> }
) {
  try {
    if (!context?.params) {
      return NextResponse.json({ error: 'Missing artifact ID parameter' }, { status: 400 });
    }

    const { artifactId } = await context.params;
    const searchParams = request.nextUrl.searchParams;

    // Parse pagination parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(
      Math.max(1, parseInt(searchParams.get('pageSize') || '50')),
      100 // Max 100 files per page
    );
    const statusFilter = searchParams.get('status') || null;
    const filterType = searchParams.get('filterType') || 'test'; // 'test' or 'file'

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(artifactId)) {
      return NextResponse.json({ error: 'Invalid artifact ID format' }, { status: 400 });
    }

    // Fetch artifact to determine framework
    const artifact = await testArtifactsRepository.getArtifactByIdWithArtifact(artifactId);

    if (!artifact) {
      return NextResponse.json(
        {
          error: 'Artifact not found',
          message: `No artifact found with ID: ${artifactId}`,
        },
        { status: 404 }
      );
    }

    // Check if artifact has been processed
    if (artifact.processingStatus !== 'processed') {
      return NextResponse.json(
        {
          error: 'Artifact not processed',
          message: `Artifact is in status: ${artifact.processingStatus}`,
          processingStatus: artifact.processingStatus,
          processingError: artifact.processingError,
        },
        { status: 400 }
      );
    }

    // Detect framework type
    const frameworkType = detectFrameworkType(artifact.artifact);

    if (frameworkType === 'unknown') {
      return NextResponse.json(
        {
          error: 'Unknown framework',
          message: 'Unable to determine framework type for this artifact',
        },
        { status: 400 }
      );
    }

    // Map status filter to framework-specific values
    // Cypress uses "pending" for skipped, Playwright uses "skipped"
    let mappedStatusFilter = statusFilter;
    if (statusFilter === 'skipped' && frameworkType === 'cypress') {
      mappedStatusFilter = 'pending';
    }

    const offset = (page - 1) * pageSize;

    // Query file summaries based on framework type
    if (frameworkType === 'playwright') {
      // Build file filter based on status and filterType
      let fileFilterCondition;
      if (mappedStatusFilter === 'passed') {
        if (filterType === 'file') {
          // File-level filter: ALL tests must be passed
          fileFilterCondition = sql`
            ${playwrightTestResults.filePath} IN (
              SELECT ${playwrightTestResults.filePath}
              FROM ${playwrightTestResults}
              WHERE ${playwrightTestResults.artifactId} = ${artifactId}
              GROUP BY ${playwrightTestResults.filePath}
              HAVING COUNT(*) = COUNT(*) FILTER (WHERE ${playwrightTestResults.status} = 'passed')
                AND COUNT(*) > 0
            )
          `;
        } else {
          // Test-level filter: At least one passed test
          fileFilterCondition = sql`
            ${playwrightTestResults.filePath} IN (
              SELECT ${playwrightTestResults.filePath}
              FROM ${playwrightTestResults}
              WHERE ${playwrightTestResults.artifactId} = ${artifactId}
              GROUP BY ${playwrightTestResults.filePath}
              HAVING COUNT(*) FILTER (WHERE ${playwrightTestResults.status} = 'passed') > 0
            )
          `;
        }
      } else if (mappedStatusFilter === 'failed') {
        // Failed: At least one failed test (same for both filter types)
        fileFilterCondition = sql`
          ${playwrightTestResults.filePath} IN (
            SELECT ${playwrightTestResults.filePath}
            FROM ${playwrightTestResults}
            WHERE ${playwrightTestResults.artifactId} = ${artifactId}
            GROUP BY ${playwrightTestResults.filePath}
            HAVING COUNT(*) FILTER (WHERE ${playwrightTestResults.status} = 'failed') > 0
          )
        `;
      } else if (mappedStatusFilter === 'skipped') {
        // Skipped: At least one skipped test (same for both filter types)
        fileFilterCondition = sql`
          ${playwrightTestResults.filePath} IN (
            SELECT ${playwrightTestResults.filePath}
            FROM ${playwrightTestResults}
            WHERE ${playwrightTestResults.artifactId} = ${artifactId}
            GROUP BY ${playwrightTestResults.filePath}
            HAVING COUNT(*) FILTER (WHERE ${playwrightTestResults.status} = 'skipped') > 0
          )
        `;
      }

      // Get total count of files (optionally filtered by status)
      const allFilesQuery =
        mappedStatusFilter && fileFilterCondition
          ? sql`
          SELECT DISTINCT ${playwrightTestResults.filePath}
          FROM ${playwrightTestResults}
          WHERE ${playwrightTestResults.artifactId} = ${artifactId}
            AND ${fileFilterCondition}
        `
          : sql`
          SELECT DISTINCT ${playwrightTestResults.filePath}
          FROM ${playwrightTestResults}
          WHERE ${playwrightTestResults.artifactId} = ${artifactId}
        `;

      const totalFilesResult = await db.execute<{ filePath: string }>(allFilesQuery);
      const totalFiles = totalFilesResult.rows.length;
      const totalPages = Math.ceil(totalFiles / pageSize);

      // Get paginated file results
      const fileQuery =
        mappedStatusFilter && fileFilterCondition
          ? sql`
          SELECT
            ${playwrightTestResults.filePath} as "filePath",
            COUNT(*)::int as "totalTests",
            COUNT(*) FILTER (WHERE ${playwrightTestResults.status} = 'passed')::int as "passedTests",
            COUNT(*) FILTER (WHERE ${playwrightTestResults.status} = 'failed')::int as "failedTests",
            COUNT(*) FILTER (WHERE ${playwrightTestResults.status} = 'skipped')::int as "skippedTests",
            COUNT(*) FILTER (WHERE ${playwrightTestResults.status} = 'timedOut')::int as "timedOutTests",
            SUM(${playwrightTestResults.duration})::int as "totalDuration"
          FROM ${playwrightTestResults}
          WHERE ${playwrightTestResults.artifactId} = ${artifactId}
            AND ${fileFilterCondition}
          GROUP BY ${playwrightTestResults.filePath}
          ORDER BY ${playwrightTestResults.filePath}
          LIMIT ${pageSize}
          OFFSET ${offset}
        `
          : sql`
          SELECT
            ${playwrightTestResults.filePath} as "filePath",
            COUNT(*)::int as "totalTests",
            COUNT(*) FILTER (WHERE ${playwrightTestResults.status} = 'passed')::int as "passedTests",
            COUNT(*) FILTER (WHERE ${playwrightTestResults.status} = 'failed')::int as "failedTests",
            COUNT(*) FILTER (WHERE ${playwrightTestResults.status} = 'skipped')::int as "skippedTests",
            COUNT(*) FILTER (WHERE ${playwrightTestResults.status} = 'timedOut')::int as "timedOutTests",
            SUM(${playwrightTestResults.duration})::int as "totalDuration"
          FROM ${playwrightTestResults}
          WHERE ${playwrightTestResults.artifactId} = ${artifactId}
          GROUP BY ${playwrightTestResults.filePath}
          ORDER BY ${playwrightTestResults.filePath}
          LIMIT ${pageSize}
          OFFSET ${offset}
        `;

      const fileResults = await db.execute<{
        filePath: string;
        totalTests: number;
        passedTests: number;
        failedTests: number;
        skippedTests: number;
        timedOutTests: number;
        totalDuration: number;
      }>(fileQuery);

      // Calculate file-level statistics (all files, not just current page)
      // Always use non-filtered statistics to show overall file-level counts
      // File status logic:
      // - Failed: at least 1 test failed
      // - Passed: at least 1 test passed AND 0 tests failed
      // - Skipped: 0 tests passed AND 0 tests failed (only skipped/timedOut)
      const statsQuery = sql`
        SELECT
          COUNT(DISTINCT ${playwrightTestResults.filePath})::int as "totalFiles",
          COUNT(DISTINCT ${playwrightTestResults.filePath}) FILTER (
            WHERE ${playwrightTestResults.filePath} IN (
              SELECT ${playwrightTestResults.filePath}
              FROM ${playwrightTestResults}
              WHERE ${playwrightTestResults.artifactId} = ${artifactId}
              GROUP BY ${playwrightTestResults.filePath}
              HAVING COUNT(*) FILTER (WHERE ${playwrightTestResults.status} = 'failed') > 0
            )
          )::int as "failedFiles",
          COUNT(DISTINCT ${playwrightTestResults.filePath}) FILTER (
            WHERE ${playwrightTestResults.filePath} IN (
              SELECT ${playwrightTestResults.filePath}
              FROM ${playwrightTestResults}
              WHERE ${playwrightTestResults.artifactId} = ${artifactId}
              GROUP BY ${playwrightTestResults.filePath}
              HAVING COUNT(*) FILTER (WHERE ${playwrightTestResults.status} = 'passed') > 0
                AND COUNT(*) FILTER (WHERE ${playwrightTestResults.status} = 'failed') = 0
            )
          )::int as "passedFiles",
          COUNT(DISTINCT ${playwrightTestResults.filePath}) FILTER (
            WHERE ${playwrightTestResults.filePath} IN (
              SELECT ${playwrightTestResults.filePath}
              FROM ${playwrightTestResults}
              WHERE ${playwrightTestResults.artifactId} = ${artifactId}
              GROUP BY ${playwrightTestResults.filePath}
              HAVING COUNT(*) FILTER (WHERE ${playwrightTestResults.status} = 'passed') = 0
                AND COUNT(*) FILTER (WHERE ${playwrightTestResults.status} = 'failed') = 0
            )
          )::int as "skippedFiles"
        FROM ${playwrightTestResults}
        WHERE ${playwrightTestResults.artifactId} = ${artifactId}
      `;

      const statsResult = await db.execute<{
        totalFiles: number;
        failedFiles: number;
        passedFiles: number;
        skippedFiles: number;
      }>(statsQuery);

      const stats = statsResult.rows[0] || {
        totalFiles: 0,
        failedFiles: 0,
        passedFiles: 0,
        skippedFiles: 0,
      };

      return NextResponse.json({
        framework: 'playwright',
        data: fileResults.rows,
        pagination: {
          page,
          pageSize,
          totalPages,
          totalFiles,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
        statistics: {
          totalFiles: stats.totalFiles,
          passedFiles: stats.passedFiles,
          failedFiles: stats.failedFiles,
          skippedFiles: stats.skippedFiles,
        },
      });
    } else if (frameworkType === 'cypress') {
      // Build file filter based on status and filterType
      let fileFilterCondition;
      if (mappedStatusFilter === 'passed') {
        if (filterType === 'file') {
          // File-level filter: ALL tests must be passed
          fileFilterCondition = sql`
            ${cypressTestResults.specFile} IN (
              SELECT ${cypressTestResults.specFile}
              FROM ${cypressTestResults}
              WHERE ${cypressTestResults.artifactId} = ${artifactId}
              GROUP BY ${cypressTestResults.specFile}
              HAVING COUNT(*) = COUNT(*) FILTER (WHERE ${cypressTestResults.state} = 'passed')
                AND COUNT(*) > 0
            )
          `;
        } else {
          // Test-level filter: At least one passed test
          fileFilterCondition = sql`
            ${cypressTestResults.specFile} IN (
              SELECT ${cypressTestResults.specFile}
              FROM ${cypressTestResults}
              WHERE ${cypressTestResults.artifactId} = ${artifactId}
              GROUP BY ${cypressTestResults.specFile}
              HAVING COUNT(*) FILTER (WHERE ${cypressTestResults.state} = 'passed') > 0
            )
          `;
        }
      } else if (mappedStatusFilter === 'failed') {
        // Failed: At least one failed test (same for both filter types)
        fileFilterCondition = sql`
          ${cypressTestResults.specFile} IN (
            SELECT ${cypressTestResults.specFile}
            FROM ${cypressTestResults}
            WHERE ${cypressTestResults.artifactId} = ${artifactId}
            GROUP BY ${cypressTestResults.specFile}
            HAVING COUNT(*) FILTER (WHERE ${cypressTestResults.state} = 'failed') > 0
          )
        `;
      } else if (mappedStatusFilter === 'pending') {
        // Skipped: At least one skipped test (same for both filter types)
        fileFilterCondition = sql`
          ${cypressTestResults.specFile} IN (
            SELECT ${cypressTestResults.specFile}
            FROM ${cypressTestResults}
            WHERE ${cypressTestResults.artifactId} = ${artifactId}
            GROUP BY ${cypressTestResults.specFile}
            HAVING COUNT(*) FILTER (WHERE ${cypressTestResults.state} = 'pending') > 0
          )
        `;
      }

      // Get total count of files (optionally filtered by status)
      const allFilesQuery = mappedStatusFilter
        ? sql`
          SELECT DISTINCT ${cypressTestResults.specFile}
          FROM ${cypressTestResults}
          WHERE ${cypressTestResults.artifactId} = ${artifactId}
            AND ${fileFilterCondition}
        `
        : sql`
          SELECT DISTINCT ${cypressTestResults.specFile}
          FROM ${cypressTestResults}
          WHERE ${cypressTestResults.artifactId} = ${artifactId}
        `;

      const totalFilesResult = await db.execute<{ specFile: string }>(allFilesQuery);
      const totalFiles = totalFilesResult.rows.length;
      const totalPages = Math.ceil(totalFiles / pageSize);

      // Get paginated file results
      const fileQuery = mappedStatusFilter
        ? sql`
          SELECT
            ${cypressTestResults.specFile} as "specFile",
            COUNT(*)::int as "totalTests",
            COUNT(*) FILTER (WHERE ${cypressTestResults.state} = 'passed')::int as "passedTests",
            COUNT(*) FILTER (WHERE ${cypressTestResults.state} = 'failed')::int as "failedTests",
            COUNT(*) FILTER (WHERE ${cypressTestResults.state} = 'pending')::int as "skippedTests",
            SUM(${cypressTestResults.duration})::int as "totalDuration"
          FROM ${cypressTestResults}
          WHERE ${cypressTestResults.artifactId} = ${artifactId}
            AND ${fileFilterCondition}
          GROUP BY ${cypressTestResults.specFile}
          ORDER BY ${cypressTestResults.specFile}
          LIMIT ${pageSize}
          OFFSET ${offset}
        `
        : sql`
          SELECT
            ${cypressTestResults.specFile} as "specFile",
            COUNT(*)::int as "totalTests",
            COUNT(*) FILTER (WHERE ${cypressTestResults.state} = 'passed')::int as "passedTests",
            COUNT(*) FILTER (WHERE ${cypressTestResults.state} = 'failed')::int as "failedTests",
            COUNT(*) FILTER (WHERE ${cypressTestResults.state} = 'pending')::int as "skippedTests",
            SUM(${cypressTestResults.duration})::int as "totalDuration"
          FROM ${cypressTestResults}
          WHERE ${cypressTestResults.artifactId} = ${artifactId}
          GROUP BY ${cypressTestResults.specFile}
          ORDER BY ${cypressTestResults.specFile}
          LIMIT ${pageSize}
          OFFSET ${offset}
        `;

      const fileResults = await db.execute<{
        specFile: string;
        totalTests: number;
        passedTests: number;
        failedTests: number;
        skippedTests: number;
        totalDuration: number;
      }>(fileQuery);

      // Calculate file-level statistics (all files, not just current page)
      // Always use non-filtered statistics to show overall file-level counts
      // File status logic:
      // - Failed: at least 1 test failed
      // - Passed: at least 1 test passed AND 0 tests failed
      // - Skipped: 0 tests passed AND 0 tests failed (only pending)
      const statsQuery = sql`
        SELECT
          COUNT(DISTINCT ${cypressTestResults.specFile})::int as "totalFiles",
          COUNT(DISTINCT ${cypressTestResults.specFile}) FILTER (
            WHERE ${cypressTestResults.specFile} IN (
              SELECT ${cypressTestResults.specFile}
              FROM ${cypressTestResults}
              WHERE ${cypressTestResults.artifactId} = ${artifactId}
              GROUP BY ${cypressTestResults.specFile}
              HAVING COUNT(*) FILTER (WHERE ${cypressTestResults.state} = 'failed') > 0
            )
          )::int as "failedFiles",
          COUNT(DISTINCT ${cypressTestResults.specFile}) FILTER (
            WHERE ${cypressTestResults.specFile} IN (
              SELECT ${cypressTestResults.specFile}
              FROM ${cypressTestResults}
              WHERE ${cypressTestResults.artifactId} = ${artifactId}
              GROUP BY ${cypressTestResults.specFile}
              HAVING COUNT(*) FILTER (WHERE ${cypressTestResults.state} = 'passed') > 0
                AND COUNT(*) FILTER (WHERE ${cypressTestResults.state} = 'failed') = 0
            )
          )::int as "passedFiles",
          COUNT(DISTINCT ${cypressTestResults.specFile}) FILTER (
            WHERE ${cypressTestResults.specFile} IN (
              SELECT ${cypressTestResults.specFile}
              FROM ${cypressTestResults}
              WHERE ${cypressTestResults.artifactId} = ${artifactId}
              GROUP BY ${cypressTestResults.specFile}
              HAVING COUNT(*) FILTER (WHERE ${cypressTestResults.state} = 'passed') = 0
                AND COUNT(*) FILTER (WHERE ${cypressTestResults.state} = 'failed') = 0
            )
          )::int as "skippedFiles"
        FROM ${cypressTestResults}
        WHERE ${cypressTestResults.artifactId} = ${artifactId}
      `;

      const statsResult = await db.execute<{
        totalFiles: number;
        failedFiles: number;
        passedFiles: number;
        skippedFiles: number;
      }>(statsQuery);

      const stats = statsResult.rows[0] || {
        totalFiles: 0,
        failedFiles: 0,
        passedFiles: 0,
        skippedFiles: 0,
      };

      return NextResponse.json({
        framework: 'cypress',
        data: fileResults.rows,
        pagination: {
          page,
          pageSize,
          totalPages,
          totalFiles,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
        statistics: {
          totalFiles: stats.totalFiles,
          passedFiles: stats.passedFiles,
          failedFiles: stats.failedFiles,
          skippedFiles: stats.skippedFiles,
        },
      });
    }

    // Should never reach here due to framework detection
    return NextResponse.json({ error: 'Unsupported framework' }, { status: 500 });
  } catch (error) {
    console.error('Error fetching file summaries:', error);

    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof ApplicationError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.statusCode }
      );
    }

    // Don't leak error details to client for unexpected errors
    return NextResponse.json(
      {
        error: 'Failed to fetch file summaries',
      },
      { status: 500 }
    );
  }
}

// Export GET handler with event logging (no auth required for reading)
export const GET = withEventLogging(handleGET);
