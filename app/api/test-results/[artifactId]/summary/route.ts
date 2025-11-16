// API endpoint for fetching summary statistics for a specific artifact

import { NextRequest, NextResponse } from 'next/server';
import { withEventLogging } from '@/lib/events/with-logging';
import { getProcessor, detectFrameworkType } from '@/lib/processors';
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

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(artifactId)) {
      return NextResponse.json({ error: 'Invalid artifact ID format' }, { status: 400 });
    }

    // Fetch artifact
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

    // Detect framework and get processor
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

    const processor = getProcessor(artifact.artifact);

    // Get summary statistics from the processor
    const stats = processor.getSummaryStats(artifact.artifact);

    // Calculate cumulative duration from all tests (sum of individual test durations)
    const results = processor.parseResults(artifact.artifact);
    const cumulativeDuration = results.reduce((sum, result) => sum + (result.duration || 0), 0);

    // Get timing information (wall-clock duration from start to end)
    const timingInfo = processor.getTimingInfo(artifact.artifact);
    const wallClockDuration = timingInfo.wallClockDuration || cumulativeDuration;

    // Calculate efficiency: how much faster the tests completed due to parallelization
    // efficiency = (cumulative - wallClock) / cumulative * 100
    let efficiencyPercent: number | null = null;
    if (cumulativeDuration > 0 && wallClockDuration > 0 && wallClockDuration < cumulativeDuration) {
      efficiencyPercent = ((cumulativeDuration - wallClockDuration) / cumulativeDuration) * 100;
    }

    // Calculate additional metrics
    const passRate = stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(2) : '0.00';
    const failRate = stats.total > 0 ? ((stats.failed / stats.total) * 100).toFixed(2) : '0.00';

    return NextResponse.json({
      framework: frameworkType,
      frameworkVersion: artifact.frameworkVersion,
      processingStatus: artifact.processingStatus,
      processedAt: artifact.processedAt,
      processingDurationMs: artifact.processingDurationMs,
      cumulativeDuration, // Sum of all test durations
      wallClockDuration, // Actual time from start to end
      efficiencyPercent, // Percentage faster due to parallelization
      startTime: timingInfo.startTime,
      endTime: timingInfo.endTime,
      createdAt: artifact.createdAt,
      updatedAt: artifact.updatedAt,
      statistics: {
        total: stats.total,
        passed: stats.passed,
        failed: stats.failed,
        skipped: stats.skipped || 0,
        pending: stats.pending || 0,
        timedOut: stats.timedOut || 0,
        passRate: parseFloat(passRate),
        failRate: parseFloat(failRate),
      },
      metadata: {
        githubRepository: artifact.githubRepository,
        githubSha: artifact.githubSha,
        githubHeadRef: artifact.githubHeadRef,
        githubBaseRef: artifact.githubBaseRef,
        githubRef: artifact.githubRef,
        githubActor: artifact.githubActor,
        githubRunId: artifact.githubRunId,
        githubRunNumber: artifact.githubRunNumber,
        createdAt: artifact.createdAt,
      },
    });
  } catch (error) {
    console.error('Error fetching test summary:', error);

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
        error: 'Failed to fetch test summary',
      },
      { status: 500 }
    );
  }
}

// Export GET handler with event logging (no auth required for reading)
export const GET = withEventLogging(handleGET);
