// API endpoint for manually reprocessing failed test artifacts

import { NextRequest, NextResponse } from 'next/server';
import { withJwtRole, type JwtPayload } from '@/lib/auth/jwt';
import { withEventLogging } from '@/lib/events/with-logging';
import { triggerProcessing } from '@/lib/jobs/process-artifact';
import {
  testArtifactsRepository,
  NotFoundError,
  ApplicationError,
  ConflictError,
} from '@/lib/db/repositories';

async function handlePOST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  payload?: JwtPayload
) {
  try {
    const { id } = await context.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: 'Invalid artifact ID format' }, { status: 400 });
    }

    // Extract user context from JWT payload
    const userContext = payload
      ? {
          userId: payload.sub || '',
          roles: payload.roles || [],
        }
      : undefined;

    // Fetch the artifact to verify it exists
    const artifact = await testArtifactsRepository.getArtifactById(id);

    if (!artifact) {
      return NextResponse.json(
        { error: 'Artifact not found', message: `No artifact found with ID: ${id}` },
        { status: 404 }
      );
    }

    // Check if artifact is already being processed
    if (artifact.processingStatus === 'processing') {
      return NextResponse.json(
        {
          error: 'Already processing',
          message: 'This artifact is currently being processed',
        },
        { status: 409 }
      );
    }

    // Reset processing status to 'pending' and clear error
    await testArtifactsRepository.updateProcessingStatus(
      id,
      'pending',
      {
        error: undefined,
        durationMs: undefined,
      },
      undefined,
      userContext
    );

    // Trigger background reprocessing
    triggerProcessing(id);

    return NextResponse.json(
      {
        success: true,
        message: 'Artifact reprocessing triggered',
        artifactId: id,
        previousStatus: artifact.processingStatus,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error triggering artifact reprocessing:', error);

    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof ApplicationError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Failed to trigger reprocessing', message: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// Export POST handler with JWT authentication and event logging
// Requires 'admin' role - reprocessing is a sensitive operation
export const POST = withEventLogging(withJwtRole('admin')(handlePOST));
