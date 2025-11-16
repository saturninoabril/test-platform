// API endpoint for fetching paginated test results for a specific artifact

import { NextRequest, NextResponse } from 'next/server';
import { withEventLogging } from '@/lib/events/with-logging';
import { detectFrameworkType } from '@/lib/processors';
import {
  testArtifactsRepository,
  playwrightTestResultsRepository,
  cypressTestResultsRepository,
  ApplicationError,
  NotFoundError,
} from '@/lib/db/repositories';

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
      100 // Max 100 results per page
    );
    const statusFilter = searchParams.get('status') || null;

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

    // Query results based on framework type using repositories
    if (frameworkType === 'playwright') {
      const result = await playwrightTestResultsRepository.listResults({
        artifactId,
        page,
        pageSize,
        status: statusFilter || undefined,
      });

      return NextResponse.json({
        framework: 'playwright',
        data: result.data,
        pagination: result.pagination,
      });
    } else if (frameworkType === 'cypress') {
      const result = await cypressTestResultsRepository.listResults({
        artifactId,
        page,
        pageSize,
        state: statusFilter || undefined,
      });

      return NextResponse.json({
        framework: 'cypress',
        data: result.data,
        pagination: result.pagination,
      });
    }

    // Should never reach here due to framework detection
    return NextResponse.json({ error: 'Unsupported framework' }, { status: 500 });
  } catch (error) {
    console.error('Error fetching test results:', error);

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
        error: 'Failed to fetch test results',
      },
      { status: 500 }
    );
  }
}

// Export GET handler with event logging (no auth required for reading)
export const GET = withEventLogging(handleGET);
