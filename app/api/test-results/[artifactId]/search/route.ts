// API endpoint for searching test files and test names

import { NextRequest, NextResponse } from 'next/server';
// Complex search queries with CTEs and ranking require direct database access
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

    // Parse search and pagination parameters
    const query = searchParams.get('q') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(
      Math.max(1, parseInt(searchParams.get('pageSize') || '50')),
      100 // Max 100 files per page
    );
    const statusFilter = searchParams.get('status') || null;
    const filterType = searchParams.get('filterType') || 'test'; // 'test' or 'file'

    if (!query.trim()) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

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
    const searchPattern = `%${query}%`;

    // Build status filter condition based on filter type
    const buildStatusFilterForCypress = () => {
      if (!mappedStatusFilter) return null;

      if (mappedStatusFilter === 'passed') {
        if (filterType === 'file') {
          // File-level: ALL tests must be passed
          return sql`
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
          // Test-level: At least one passed test
          return sql`
            ${cypressTestResults.specFile} IN (
              SELECT ${cypressTestResults.specFile}
              FROM ${cypressTestResults}
              WHERE ${cypressTestResults.artifactId} = ${artifactId}
              GROUP BY ${cypressTestResults.specFile}
              HAVING COUNT(*) FILTER (WHERE ${cypressTestResults.state} = 'passed') > 0
            )
          `;
        }
      } else {
        // Failed/Skipped: At least one test with that status (same for both filter types)
        return sql`
          ${cypressTestResults.specFile} IN (
            SELECT ${cypressTestResults.specFile}
            FROM ${cypressTestResults}
            WHERE ${cypressTestResults.artifactId} = ${artifactId}
            GROUP BY ${cypressTestResults.specFile}
            HAVING COUNT(*) FILTER (WHERE ${cypressTestResults.state} = ${mappedStatusFilter}) > 0
          )
        `;
      }
    };

    // Search based on framework type
    if (frameworkType === 'playwright') {
      // Search query with ranking: files matching first, then test names
      const searchQuery = statusFilter
        ? sql`
          WITH file_matches AS (
            SELECT DISTINCT
              ${playwrightTestResults.filePath} as "filePath",
              1 as rank
            FROM ${playwrightTestResults}
            WHERE ${playwrightTestResults.artifactId} = ${artifactId}
              AND ${playwrightTestResults.filePath} ILIKE ${searchPattern}
              AND ${playwrightTestResults.filePath} IN (
                SELECT DISTINCT ${playwrightTestResults.filePath}
                FROM ${playwrightTestResults}
                WHERE ${playwrightTestResults.artifactId} = ${artifactId}
                  AND ${playwrightTestResults.status} = ${statusFilter}
              )
          ),
          test_matches AS (
            SELECT DISTINCT
              ${playwrightTestResults.filePath} as "filePath",
              2 as rank
            FROM ${playwrightTestResults}
            WHERE ${playwrightTestResults.artifactId} = ${artifactId}
              AND (
                ${playwrightTestResults.testTitle} ILIKE ${searchPattern}
                OR ${playwrightTestResults.fullTitle} ILIKE ${searchPattern}
              )
              AND ${playwrightTestResults.filePath} IN (
                SELECT DISTINCT ${playwrightTestResults.filePath}
                FROM ${playwrightTestResults}
                WHERE ${playwrightTestResults.artifactId} = ${artifactId}
                  AND ${playwrightTestResults.status} = ${statusFilter}
              )
              AND ${playwrightTestResults.filePath} NOT IN (SELECT "filePath" FROM file_matches)
          ),
          all_matches AS (
            SELECT * FROM file_matches
            UNION ALL
            SELECT * FROM test_matches
          )
          SELECT
            pr.file_path as "filePath",
            COUNT(*)::int as "totalTests",
            COUNT(*) FILTER (WHERE pr.status = 'passed')::int as "passedTests",
            COUNT(*) FILTER (WHERE pr.status = 'failed')::int as "failedTests",
            COUNT(*) FILTER (WHERE pr.status = 'skipped')::int as "skippedTests",
            COUNT(*) FILTER (WHERE pr.status = 'timedOut')::int as "timedOutTests",
            SUM(pr.duration)::int as "totalDuration",
            MIN(am.rank) as rank
          FROM ${playwrightTestResults} pr
          JOIN all_matches am ON pr.file_path = am."filePath"
          WHERE pr.artifact_id = ${artifactId}
          GROUP BY pr.file_path
          ORDER BY rank, pr.file_path
          LIMIT ${pageSize}
          OFFSET ${offset}
        `
        : sql`
          WITH file_matches AS (
            SELECT DISTINCT
              ${playwrightTestResults.filePath} as "filePath",
              1 as rank
            FROM ${playwrightTestResults}
            WHERE ${playwrightTestResults.artifactId} = ${artifactId}
              AND ${playwrightTestResults.filePath} ILIKE ${searchPattern}
          ),
          test_matches AS (
            SELECT DISTINCT
              ${playwrightTestResults.filePath} as "filePath",
              2 as rank
            FROM ${playwrightTestResults}
            WHERE ${playwrightTestResults.artifactId} = ${artifactId}
              AND (
                ${playwrightTestResults.testTitle} ILIKE ${searchPattern}
                OR ${playwrightTestResults.fullTitle} ILIKE ${searchPattern}
              )
              AND ${playwrightTestResults.filePath} NOT IN (SELECT "filePath" FROM file_matches)
          ),
          all_matches AS (
            SELECT * FROM file_matches
            UNION ALL
            SELECT * FROM test_matches
          )
          SELECT
            pr.file_path as "filePath",
            COUNT(*)::int as "totalTests",
            COUNT(*) FILTER (WHERE pr.status = 'passed')::int as "passedTests",
            COUNT(*) FILTER (WHERE pr.status = 'failed')::int as "failedTests",
            COUNT(*) FILTER (WHERE pr.status = 'skipped')::int as "skippedTests",
            COUNT(*) FILTER (WHERE pr.status = 'timedOut')::int as "timedOutTests",
            SUM(pr.duration)::int as "totalDuration",
            MIN(am.rank) as rank
          FROM ${playwrightTestResults} pr
          JOIN all_matches am ON pr.file_path = am."filePath"
          WHERE pr.artifact_id = ${artifactId}
          GROUP BY pr.file_path
          ORDER BY rank, pr.file_path
          LIMIT ${pageSize}
          OFFSET ${offset}
        `;

      // Get total count
      const countQuery = statusFilter
        ? sql`
          WITH file_matches AS (
            SELECT DISTINCT ${playwrightTestResults.filePath} as "filePath"
            FROM ${playwrightTestResults}
            WHERE ${playwrightTestResults.artifactId} = ${artifactId}
              AND ${playwrightTestResults.filePath} ILIKE ${searchPattern}
              AND ${playwrightTestResults.filePath} IN (
                SELECT DISTINCT ${playwrightTestResults.filePath}
                FROM ${playwrightTestResults}
                WHERE ${playwrightTestResults.artifactId} = ${artifactId}
                  AND ${playwrightTestResults.status} = ${statusFilter}
              )
          ),
          test_matches AS (
            SELECT DISTINCT ${playwrightTestResults.filePath} as "filePath"
            FROM ${playwrightTestResults}
            WHERE ${playwrightTestResults.artifactId} = ${artifactId}
              AND (
                ${playwrightTestResults.testTitle} ILIKE ${searchPattern}
                OR ${playwrightTestResults.fullTitle} ILIKE ${searchPattern}
              )
              AND ${playwrightTestResults.filePath} IN (
                SELECT DISTINCT ${playwrightTestResults.filePath}
                FROM ${playwrightTestResults}
                WHERE ${playwrightTestResults.artifactId} = ${artifactId}
                  AND ${playwrightTestResults.status} = ${statusFilter}
              )
              AND ${playwrightTestResults.filePath} NOT IN (SELECT "filePath" FROM file_matches)
          )
          SELECT COUNT(*)::int as count FROM (
            SELECT "filePath" FROM file_matches
            UNION
            SELECT "filePath" FROM test_matches
          ) combined
        `
        : sql`
          WITH file_matches AS (
            SELECT DISTINCT ${playwrightTestResults.filePath} as "filePath"
            FROM ${playwrightTestResults}
            WHERE ${playwrightTestResults.artifactId} = ${artifactId}
              AND ${playwrightTestResults.filePath} ILIKE ${searchPattern}
          ),
          test_matches AS (
            SELECT DISTINCT ${playwrightTestResults.filePath} as "filePath"
            FROM ${playwrightTestResults}
            WHERE ${playwrightTestResults.artifactId} = ${artifactId}
              AND (
                ${playwrightTestResults.testTitle} ILIKE ${searchPattern}
                OR ${playwrightTestResults.fullTitle} ILIKE ${searchPattern}
              )
              AND ${playwrightTestResults.filePath} NOT IN (SELECT "filePath" FROM file_matches)
          )
          SELECT COUNT(*)::int as count FROM (
            SELECT "filePath" FROM file_matches
            UNION
            SELECT "filePath" FROM test_matches
          ) combined
        `;

      const [searchResults, countResult] = await Promise.all([
        db.execute<{
          filePath: string;
          totalTests: number;
          passedTests: number;
          failedTests: number;
          skippedTests: number;
          timedOutTests: number;
          totalDuration: number;
          rank: number;
        }>(searchQuery),
        db.execute<{ count: number }>(countQuery),
      ]);

      const totalFiles = countResult.rows[0]?.count || 0;
      const totalPages = Math.ceil(totalFiles / pageSize);

      return NextResponse.json({
        framework: 'playwright',
        query,
        data: searchResults.rows,
        pagination: {
          page,
          pageSize,
          totalPages,
          totalFiles,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      });
    } else if (frameworkType === 'cypress') {
      // Build status filter condition
      const statusFilterCondition = buildStatusFilterForCypress();

      // Search query with ranking for Cypress
      const searchQuery = statusFilterCondition
        ? sql`
          WITH file_matches AS (
            SELECT DISTINCT
              ${cypressTestResults.specFile} as "specFile",
              1 as rank
            FROM ${cypressTestResults}
            WHERE ${cypressTestResults.artifactId} = ${artifactId}
              AND ${cypressTestResults.specFile} ILIKE ${searchPattern}
              AND ${statusFilterCondition}
          ),
          test_matches AS (
            SELECT DISTINCT
              ${cypressTestResults.specFile} as "specFile",
              2 as rank
            FROM ${cypressTestResults}
            WHERE ${cypressTestResults.artifactId} = ${artifactId}
              AND (
                ${cypressTestResults.testTitle} ILIKE ${searchPattern}
                OR ${cypressTestResults.fullTitle} ILIKE ${searchPattern}
              )
              AND ${statusFilterCondition}
              AND ${cypressTestResults.specFile} NOT IN (SELECT "specFile" FROM file_matches)
          ),
          all_matches AS (
            SELECT * FROM file_matches
            UNION ALL
            SELECT * FROM test_matches
          )
          SELECT
            cr.spec_file as "specFile",
            COUNT(*)::int as "totalTests",
            COUNT(*) FILTER (WHERE cr.state = 'passed')::int as "passedTests",
            COUNT(*) FILTER (WHERE cr.state = 'failed')::int as "failedTests",
            COUNT(*) FILTER (WHERE cr.state = 'pending')::int as "skippedTests",
            SUM(cr.duration)::int as "totalDuration",
            MIN(am.rank) as rank
          FROM ${cypressTestResults} cr
          JOIN all_matches am ON cr.spec_file = am."specFile"
          WHERE cr.artifact_id = ${artifactId}
          GROUP BY cr.spec_file
          ORDER BY rank, cr.spec_file
          LIMIT ${pageSize}
          OFFSET ${offset}
        `
        : sql`
          WITH file_matches AS (
            SELECT DISTINCT
              ${cypressTestResults.specFile} as "specFile",
              1 as rank
            FROM ${cypressTestResults}
            WHERE ${cypressTestResults.artifactId} = ${artifactId}
              AND ${cypressTestResults.specFile} ILIKE ${searchPattern}
          ),
          test_matches AS (
            SELECT DISTINCT
              ${cypressTestResults.specFile} as "specFile",
              2 as rank
            FROM ${cypressTestResults}
            WHERE ${cypressTestResults.artifactId} = ${artifactId}
              AND (
                ${cypressTestResults.testTitle} ILIKE ${searchPattern}
                OR ${cypressTestResults.fullTitle} ILIKE ${searchPattern}
              )
              AND ${cypressTestResults.specFile} NOT IN (SELECT "specFile" FROM file_matches)
          ),
          all_matches AS (
            SELECT * FROM file_matches
            UNION ALL
            SELECT * FROM test_matches
          )
          SELECT
            cr.spec_file as "specFile",
            COUNT(*)::int as "totalTests",
            COUNT(*) FILTER (WHERE cr.state = 'passed')::int as "passedTests",
            COUNT(*) FILTER (WHERE cr.state = 'failed')::int as "failedTests",
            COUNT(*) FILTER (WHERE cr.state = 'pending')::int as "skippedTests",
            SUM(cr.duration)::int as "totalDuration",
            MIN(am.rank) as rank
          FROM ${cypressTestResults} cr
          JOIN all_matches am ON cr.spec_file = am."specFile"
          WHERE cr.artifact_id = ${artifactId}
          GROUP BY cr.spec_file
          ORDER BY rank, cr.spec_file
          LIMIT ${pageSize}
          OFFSET ${offset}
        `;

      // Get total count
      const countQuery = statusFilterCondition
        ? sql`
          WITH file_matches AS (
            SELECT DISTINCT ${cypressTestResults.specFile} as "specFile"
            FROM ${cypressTestResults}
            WHERE ${cypressTestResults.artifactId} = ${artifactId}
              AND ${cypressTestResults.specFile} ILIKE ${searchPattern}
              AND ${statusFilterCondition}
          ),
          test_matches AS (
            SELECT DISTINCT ${cypressTestResults.specFile} as "specFile"
            FROM ${cypressTestResults}
            WHERE ${cypressTestResults.artifactId} = ${artifactId}
              AND (
                ${cypressTestResults.testTitle} ILIKE ${searchPattern}
                OR ${cypressTestResults.fullTitle} ILIKE ${searchPattern}
              )
              AND ${statusFilterCondition}
              AND ${cypressTestResults.specFile} NOT IN (SELECT "specFile" FROM file_matches)
          )
          SELECT COUNT(*)::int as count FROM (
            SELECT "specFile" FROM file_matches
            UNION
            SELECT "specFile" FROM test_matches
          ) combined
        `
        : sql`
          WITH file_matches AS (
            SELECT DISTINCT ${cypressTestResults.specFile} as "specFile"
            FROM ${cypressTestResults}
            WHERE ${cypressTestResults.artifactId} = ${artifactId}
              AND ${cypressTestResults.specFile} ILIKE ${searchPattern}
          ),
          test_matches AS (
            SELECT DISTINCT ${cypressTestResults.specFile} as "specFile"
            FROM ${cypressTestResults}
            WHERE ${cypressTestResults.artifactId} = ${artifactId}
              AND (
                ${cypressTestResults.testTitle} ILIKE ${searchPattern}
                OR ${cypressTestResults.fullTitle} ILIKE ${searchPattern}
              )
              AND ${cypressTestResults.specFile} NOT IN (SELECT "specFile" FROM file_matches)
          )
          SELECT COUNT(*)::int as count FROM (
            SELECT "specFile" FROM file_matches
            UNION
            SELECT "specFile" FROM test_matches
          ) combined
        `;

      const [searchResults, countResult] = await Promise.all([
        db.execute<{
          specFile: string;
          totalTests: number;
          passedTests: number;
          failedTests: number;
          skippedTests: number;
          totalDuration: number;
          rank: number;
        }>(searchQuery),
        db.execute<{ count: number }>(countQuery),
      ]);

      const totalFiles = countResult.rows[0]?.count || 0;
      const totalPages = Math.ceil(totalFiles / pageSize);

      return NextResponse.json({
        framework: 'cypress',
        query,
        data: searchResults.rows,
        pagination: {
          page,
          pageSize,
          totalPages,
          totalFiles,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      });
    }

    // Should never reach here due to framework detection
    return NextResponse.json({ error: 'Unsupported framework' }, { status: 500 });
  } catch (error) {
    console.error('Error searching test results:', error);

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
        error: 'Failed to search test results',
      },
      { status: 500 }
    );
  }
}

// Export GET handler with event logging (no auth required for reading)
export const GET = withEventLogging(handleGET);
