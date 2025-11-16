// Higher-Order Function for Event Logging

import { NextRequest } from 'next/server';
import { logEvent } from './logger';
import { extractJwtTokenDetails } from './masking';
import type { ApiEventData } from './types';

type RouteHandler = (
  req: NextRequest,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context?: { params?: Promise<any> }
) => Promise<Response>;

/**
 * Wraps a Next.js API route handler with event logging
 * @param handler - The original route handler
 * @returns Wrapped handler that logs all requests/responses
 */
export function withEventLogging(handler: RouteHandler): RouteHandler {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (req: NextRequest, context?: { params?: Promise<any> }) => {
    const eventId = crypto.randomUUID();
    const requestTimestamp = new Date();
    const startTime = Date.now();

    // Capture request payload BEFORE calling handler (body can only be read once)
    let requestPayload: unknown = null;
    let requestPayloadSize: number | null = null;
    const contentType = req.headers.get('content-type');

    if (contentType && isJsonContentType(contentType)) {
      try {
        const clonedReq = req.clone();
        const body = await clonedReq.text();
        requestPayloadSize = body.length;

        if (body.length > 0) {
          requestPayload = JSON.parse(body);
        }
      } catch {
        // Failed to parse - ignore
      }
    } else if (contentType) {
      // Non-JSON content: record size only
      try {
        const clonedReq = req.clone();
        const body = await clonedReq.text();
        requestPayloadSize = body.length;
      } catch {
        // Failed to read size - ignore
      }
    }

    let statusCode = 500; // Default to 500 if error occurs before response
    let errorType: string | null = null;
    let errorMessage: string | null = null;
    let response: Response | null = null;

    try {
      // Execute the original handler
      response = await handler(req, context);
      statusCode = response.status;

      return response;
    } catch (error) {
      // Capture error details
      errorType = error instanceof Error ? error.constructor.name : 'UnknownError';
      errorMessage = error instanceof Error ? error.message : String(error);
      throw error; // Re-throw to let Next.js handle it
    } finally {
      // Log event asynchronously (non-blocking)
      const responseTimestamp = new Date();
      const durationMs = Date.now() - startTime;

      // Capture response payload (if response exists and is JSON)
      let responsePayload: unknown = null;
      let responsePayloadSize: number | null = null;

      if (response) {
        const responseContentType = response.headers.get('content-type');
        if (responseContentType && isJsonContentType(responseContentType)) {
          try {
            const clonedRes = response.clone();
            const body = await clonedRes.text();
            responsePayloadSize = body.length;

            if (body.length > 0) {
              responsePayload = JSON.parse(body);
            }
          } catch {
            // Failed to parse - ignore
          }
        }
      }

      // Extract JWT token details
      const jwtDetails = extractJwtTokenDetails(req.headers);

      const eventData: ApiEventData = {
        id: eventId,
        method: req.method || 'UNKNOWN',
        endpoint: req.nextUrl.pathname,
        statusCode,
        requestTimestamp,
        responseTimestamp,
        durationMs,
        authenticationStatus: determineAuthStatus(req, statusCode),
        maskedJWTToken: jwtDetails.maskedToken,
        jwtSubject: jwtDetails.subject,
        jwtRoles: jwtDetails.roles,
        sourceIdentifier: getSourceIdentifier(req),
        errorType,
        errorMessage,
        requestPayload,
        requestPayloadSize,
        responsePayload,
        responsePayloadSize,
        context: {
          userAgent: req.headers.get('user-agent') || undefined,
          requestId: req.headers.get('x-request-id') || undefined,
          contentType: contentType || undefined,
        },
      };

      // Fire and forget - don't await
      logEvent(eventData).catch(() => {
        // Errors already logged in logEvent function
      });
    }
  };
}

/**
 * Checks if a Content-Type header is JSON
 */
function isJsonContentType(contentType: string): boolean {
  const normalized = contentType.toLowerCase().split(';')[0].trim();
  return normalized === 'application/json' || normalized.endsWith('+json');
}

/**
 * Determines authentication status based on headers and status code
 */
function determineAuthStatus(
  req: NextRequest,
  statusCode: number
): 'authenticated' | 'unauthenticated' | 'auth_failed' {
  const hasAuthToken = req.headers.has('authorization');

  if (statusCode === 401) return 'auth_failed';
  if (hasAuthToken) return 'authenticated';
  return 'unauthenticated';
}

/**
 * Extracts source IP address from request headers
 */
function getSourceIdentifier(req: NextRequest): string | null {
  // Try to get real IP from common headers
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    null
  );
}
