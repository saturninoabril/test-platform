// API endpoint for fetching test details for specific files

import { NextRequest, NextResponse } from 'next/server';
// Direct queries with inArray for batch file filtering
// eslint-disable-next-line no-restricted-imports
import { db } from '@/lib/db';
// eslint-disable-next-line no-restricted-imports
import { playwrightTestResults, cypressTestResults } from '@/lib/db/schema';
import { withEventLogging } from '@/lib/events/with-logging';
import { eq, and, inArray, desc } from 'drizzle-orm';
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

    // Get comma-separated list of files
    const filesParam = searchParams.get('files');
    if (!filesParam) {
      return NextResponse.json({ error: 'Missing files parameter' }, { status: 400 });
    }

    const files = filesParam
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean);
    if (files.length === 0) {
      return NextResponse.json({ error: 'No files specified' }, { status: 400 });
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

    // Query test results based on framework type
    if (frameworkType === 'playwright') {
      const results = await db
        .select({
          id: playwrightTestResults.id,
          testTitle: playwrightTestResults.testTitle,
          fullTitle: playwrightTestResults.fullTitle,
          status: playwrightTestResults.status,
          duration: playwrightTestResults.duration,
          filePath: playwrightTestResults.filePath,
          projectName: playwrightTestResults.projectName,
          retryAttempt: playwrightTestResults.retryAttempt,
          errorMessage: playwrightTestResults.errorMessage,
          browser: playwrightTestResults.browser,
        })
        .from(playwrightTestResults)
        .where(
          and(
            eq(playwrightTestResults.artifactId, artifactId),
            inArray(playwrightTestResults.filePath, files)
          )
        )
        .orderBy(desc(playwrightTestResults.createdAt));

      return NextResponse.json({
        framework: 'playwright',
        data: results,
      });
    } else if (frameworkType === 'cypress') {
      const results = await db
        .select({
          id: cypressTestResults.id,
          testUuid: cypressTestResults.testUuid,
          testTitle: cypressTestResults.testTitle,
          fullTitle: cypressTestResults.fullTitle,
          state: cypressTestResults.state,
          duration: cypressTestResults.duration,
          specFile: cypressTestResults.specFile,
          code: cypressTestResults.code,
          errorMessage: cypressTestResults.errorMessage,
          speed: cypressTestResults.speed,
        })
        .from(cypressTestResults)
        .where(
          and(
            eq(cypressTestResults.artifactId, artifactId),
            inArray(cypressTestResults.specFile, files)
          )
        )
        .orderBy(desc(cypressTestResults.createdAt));

      return NextResponse.json({
        framework: 'cypress',
        data: results,
      });
    }

    // Should never reach here due to framework detection
    return NextResponse.json({ error: 'Unsupported framework' }, { status: 500 });
  } catch (error) {
    console.error('Error fetching test details:', error);

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
        error: 'Failed to fetch test details',
      },
      { status: 500 }
    );
  }
}

// Export GET handler with event logging (no auth required for reading)
export const GET = withEventLogging(handleGET);
