import { NextRequest, NextResponse } from 'next/server';
import { withEventLogging } from '@/lib/events/with-logging';
import { testArtifactsRepository, NotFoundError, ApplicationError } from '@/lib/db/repositories';

// GET a specific test artifact (public endpoint for detail pages)
async function handleGET(request: NextRequest, context?: { params?: Promise<{ id: string }> }) {
  try {
    if (!context?.params) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Missing route parameters' },
        { status: 400 }
      );
    }

    const { id } = await context.params;

    // Fetch test artifact with full artifact payload
    const artifact = await testArtifactsRepository.getArtifactByIdWithArtifact(id);

    if (!artifact) {
      return NextResponse.json({ error: 'Test artifact not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: artifact,
    });
  } catch (error) {
    console.error('Error fetching test artifact:', error);

    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof ApplicationError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch test artifact', message: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// Export with event logging (no authentication required for public detail pages)
export const GET = withEventLogging(handleGET);
