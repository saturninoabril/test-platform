// Event Data Types

export interface ApiEventData {
  id: string;
  method: string;
  endpoint: string;
  statusCode: number;
  requestTimestamp: Date;
  responseTimestamp: Date;
  durationMs: number;
  authenticationStatus: 'authenticated' | 'unauthenticated' | 'auth_failed';
  maskedJWTToken?: string | null; // Masked JWT token
  jwtSubject?: string | null; // JWT subject (service/user identifier)
  jwtRoles?: string | null; // Comma-separated JWT roles
  sourceIdentifier?: string | null;
  errorType?: string | null;
  errorMessage?: string | null;
  requestPayload?: unknown | null; // Only for JSON Content-Type
  requestPayloadSize?: number | null; // All Content-Types
  responsePayload?: unknown | null;
  responsePayloadSize?: number | null;
  payloadTruncated?: string | null;
  context?: Record<string, unknown>;
}

// Event Query Parameters

export interface EventQueryParams {
  // Filtering
  endpoint?: string; // Filter by exact endpoint path
  method?: string; // Filter by HTTP method (GET, POST, etc.)
  statusCode?: number; // Filter by status code (200, 400, 500, etc.)
  startDate?: Date; // Filter by date range start (inclusive)
  endDate?: Date; // Filter by date range end (inclusive)
  authenticationStatus?: 'authenticated' | 'unauthenticated' | 'auth_failed';

  // Pagination
  page?: number; // Page number (1-indexed, default: 1)
  pageSize?: number; // Records per page (default: 50, max: 100)

  // Sorting
  sortBy?: 'createdAt' | 'durationMs' | 'statusCode'; // Sort field
  sortOrder?: 'asc' | 'desc'; // Sort direction (default: 'desc')
}

export interface EventQueryResult {
  data: ApiEvent[]; // Array of event records
  pagination: {
    page: number; // Current page number
    pageSize: number; // Records per page
    totalRecords: number; // Total matching records
    totalPages: number; // Total pages available
  };
}

// Database record type (matches Drizzle schema)
export interface ApiEvent {
  id: string;
  method: string;
  endpoint: string;
  statusCode: number;
  requestTimestamp: Date;
  responseTimestamp: Date;
  durationMs: number;
  authenticationStatus: string;
  maskedJWTToken: string | null;
  jwtSubject: string | null;
  jwtRoles: string | null;
  sourceIdentifier: string | null;
  errorType: string | null;
  errorMessage: string | null;
  requestPayload: unknown | null;
  responsePayload: unknown | null;
  requestPayloadSize: number | null;
  responsePayloadSize: number | null;
  payloadTruncated: string | null;
  context: Record<string, unknown> | null;
  createdAt: Date;
}
