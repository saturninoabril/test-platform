import { NextRequest, NextResponse } from 'next/server';
import { withJwtRole, type JwtPayload } from '@/lib/auth/jwt';
import { apiEventsRepository, NotFoundError, ApplicationError } from '@/lib/db/repositories';

async function handleGET(
  request: NextRequest,
  context?: { params: Promise<{ id: string }> },
  payload?: JwtPayload
) {
  try {
    if (!context?.params) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Missing route parameters' },
        { status: 400 }
      );
    }

    const { id } = await context.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'Invalid event ID format: must be a valid UUID',
          code: 'INVALID_ID_FORMAT',
        },
        { status: 400 }
      );
    }

    // Extract user context from JWT payload
    const userContext = payload
      ? {
          userId: payload.sub || '',
          roles: payload.roles || [],
        }
      : undefined;

    // Fetch event via repository
    const event = await apiEventsRepository.getEventById(id, undefined, userContext);

    if (!event) {
      return NextResponse.json(
        {
          error: 'Not Found',
          message: `Event with ID ${id} not found`,
          code: 'EVENT_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(event);
  } catch (error) {
    console.error('Failed to fetch event:', error);

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
      { error: 'Internal Server Error', message: 'Failed to fetch event' },
      { status: 500 }
    );
  }
}

// Export with JWT authentication - requires admin role
export const GET = withJwtRole('admin')(handleGET);
