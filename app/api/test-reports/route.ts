import { NextRequest, NextResponse } from 'next/server';
import { withJwtRole, type JwtPayload } from '@/lib/auth/jwt';
import { withEventLogging } from '@/lib/events/with-logging';
import { triggerProcessing } from '@/lib/jobs/process-artifact';
import {
  testArtifactsRepository,
  type CreateTestArtifactInput,
  ValidationError,
  ApplicationError,
} from '@/lib/db/repositories';

interface TestArtifactRequest {
  framework: string;
  artifact: Record<string, unknown>; // Raw test artifact JSON

  // GitHub Actions metadata
  githubRepository?: string;
  githubSha?: string;
  githubHeadRef?: string;
  githubBaseRef?: string;
  githubRef?: string;
  githubActor?: string;
  githubRunId?: string;
  githubRunNumber?: number;
  githubRunAttempt?: number;
  githubJob?: string;
  runnerName?: string;
}

// GET handler - List test reports with summaries
async function handleGET(request: NextRequest, _context?: unknown) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100);
    const frameworkParam = searchParams.get('framework');

    // Build filter object
    const framework =
      frameworkParam === 'playwright' || frameworkParam === 'cypress' || frameworkParam === 'jest'
        ? frameworkParam
        : undefined;

    // Use repository to list artifacts
    const result = await testArtifactsRepository.listArtifacts({
      page,
      pageSize,
      framework,
    });

    // Get summaries for all artifacts in this page
    const artifactIds = result.data.map((report) => report.id);
    const summaries = await testArtifactsRepository.getSummariesForArtifacts(artifactIds);

    // Combine artifacts with their summaries
    const reportsWithMetadata = result.data.map((report) => ({
      id: report.id,
      framework: report.framework,
      createdAt: report.createdAt,
      githubRepository: report.githubRepository,
      githubSha: report.githubSha,
      githubHeadRef: report.githubHeadRef,
      githubBaseRef: report.githubBaseRef,
      githubRef: report.githubRef,
      githubActor: report.githubActor,
      githubRunId: report.githubRunId,
      githubRunNumber: report.githubRunNumber,
      githubRunAttempt: report.githubRunAttempt,
      githubJob: report.githubJob,
      runnerName: report.runnerName,
      processingStatus: report.processingStatus,
      frameworkVersion: report.frameworkVersion,
      summary: summaries.get(report.id) || null, // Frontend handles null summaries
    }));

    return NextResponse.json({
      success: true,
      data: reportsWithMetadata,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Error fetching test reports:', error);

    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Bad Request', message: error.message },
        { status: error.statusCode }
      );
    }

    if (error instanceof ApplicationError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch test reports', message: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

async function handlePOST(request: NextRequest, _context?: unknown, payload?: JwtPayload) {
  try {
    const body: TestArtifactRequest = await request.json();

    // Repository will validate the input schema automatically
    const input: CreateTestArtifactInput = {
      framework: body.framework as 'playwright' | 'cypress' | 'jest',
      artifact: body.artifact,
      githubRepository: body.githubRepository,
      githubSha: body.githubSha,
      githubHeadRef: body.githubHeadRef,
      githubBaseRef: body.githubBaseRef,
      githubRef: body.githubRef,
      githubActor: body.githubActor,
      githubRunId: body.githubRunId,
      githubRunNumber: body.githubRunNumber,
      githubRunAttempt: body.githubRunAttempt,
      githubJob: body.githubJob,
      runnerName: body.runnerName,
    };

    // Extract user context from JWT payload
    const userContext = payload
      ? {
          userId: payload.sub || '',
          roles: payload.roles || [],
        }
      : undefined;

    // Create artifact via repository (automatically sets status to 'pending')
    const artifact = await testArtifactsRepository.createArtifact(input, undefined, userContext);

    // Trigger background processing in fire-and-forget mode
    triggerProcessing(artifact.id);

    return NextResponse.json(
      {
        success: true,
        data: {
          id: artifact.id,
          framework: artifact.framework,
          createdAt: artifact.createdAt,
          processingStatus: artifact.processingStatus,
          githubRepository: artifact.githubRepository,
          githubSha: artifact.githubSha,
          githubActor: artifact.githubActor,
          githubRunNumber: artifact.githubRunNumber,
          githubRunAttempt: artifact.githubRunAttempt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error saving test artifact:', error);

    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Bad Request', message: error.message },
        { status: error.statusCode }
      );
    }

    if (error instanceof ApplicationError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Failed to save test artifact', message: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// Export GET handler with event logging (no authentication required for public dashboard)
export const GET = withEventLogging(handleGET);

// Export POST handler with JWT authentication and event logging
// Requires 'write:reports' role (admin has access via hierarchy)
export const POST = withEventLogging(withJwtRole('write:reports')(handlePOST));
