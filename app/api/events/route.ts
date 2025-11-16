import { NextRequest, NextResponse } from 'next/server';
import { withJwtRole, type JwtPayload } from '@/lib/auth/jwt';
import {
  apiEventsRepository,
  type ListApiEventsInput,
  ValidationError,
  ApplicationError,
} from '@/lib/db/repositories';

async function handleGET(request: NextRequest, _context?: unknown, payload?: JwtPayload) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const endpoint = searchParams.get('endpoint') || undefined;
    const method = searchParams.get('method') || undefined;
    const statusCodeParam = searchParams.get('statusCode');
    const statusCode = statusCodeParam ? parseInt(statusCodeParam) : undefined;
    const startDateParam = searchParams.get('startDate');
    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDateParam = searchParams.get('endDate');
    const endDate = endDateParam ? new Date(endDateParam) : undefined;
    const authenticationStatus = searchParams.get('authenticationStatus') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const sortByParam = searchParams.get('sortBy');
    const sortBy =
      sortByParam === 'createdAt' || sortByParam === 'durationMs' || sortByParam === 'statusCode'
        ? sortByParam
        : 'createdAt';
    const sortOrderParam = searchParams.get('sortOrder');
    const sortOrder =
      sortOrderParam === 'asc' || sortOrderParam === 'desc' ? sortOrderParam : 'desc';

    // Build filter object (repository will validate)
    const filters: ListApiEventsInput = {
      page,
      pageSize,
      endpoint,
      method,
      statusCode,
      authenticationStatus,
      startDate,
      endDate,
      sortBy,
      sortOrder,
    };

    // Extract user context from JWT payload
    const userContext = payload
      ? {
          userId: payload.sub || '',
          roles: payload.roles || [],
        }
      : undefined;

    // Use repository to list events
    const result = await apiEventsRepository.listEvents(filters, undefined, userContext);

    return NextResponse.json({
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Failed to query events:', error);

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
      { error: 'Internal Server Error', message: 'Failed to query events' },
      { status: 500 }
    );
  }
}

// Export with JWT authentication - requires admin role
export const GET = withJwtRole('admin')(handleGET);
