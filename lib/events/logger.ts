// Event Logging Core

import { apiEventsRepository, type CreateApiEventInput } from '@/lib/db/repositories';
import type { ApiEventData } from './types';

const MAX_PAYLOAD_SIZE = parseInt(process.env.MAX_EVENT_PAYLOAD_SIZE || '1048576'); // 1 MB default

/**
 * Logs an API event to the database
 * @param eventData - Event data to log
 */
export async function logEvent(eventData: ApiEventData): Promise<void> {
  try {
    // Truncate payloads if they exceed the maximum size
    const { requestPayload, responsePayload, requestPayloadSize, responsePayloadSize } =
      truncatePayloads(eventData);

    // Determine truncation flag
    const payloadTruncated = determinePayloadTruncation(
      eventData.requestPayloadSize,
      eventData.responsePayloadSize,
      MAX_PAYLOAD_SIZE
    );

    // Create event via repository
    const input: CreateApiEventInput = {
      method: eventData.method,
      endpoint: eventData.endpoint,
      statusCode: eventData.statusCode,
      requestTimestamp: eventData.requestTimestamp,
      responseTimestamp: eventData.responseTimestamp,
      durationMs: eventData.durationMs,
      authenticationStatus: eventData.authenticationStatus,
      maskedJWTToken: eventData.maskedJWTToken || undefined,
      jwtSubject: eventData.jwtSubject || undefined,
      jwtRoles: eventData.jwtRoles || undefined,
      sourceIdentifier: eventData.sourceIdentifier || undefined,
      errorType: eventData.errorType || undefined,
      errorMessage: eventData.errorMessage || undefined,
      requestPayload,
      responsePayload,
      requestPayloadSize: requestPayloadSize || undefined,
      responsePayloadSize: responsePayloadSize || undefined,
      payloadTruncated: payloadTruncated || undefined,
      context: eventData.context || undefined,
    };

    await apiEventsRepository.createEvent(input);
  } catch (error) {
    // Don't throw - event logging failures shouldn't break API
    // Suppress console logs in tests to avoid noise
    if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
      console.error('[EventLogger] Failed to log event:', {
        eventId: eventData.id,
        endpoint: eventData.endpoint,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

/**
 * Truncates request and response payloads if they exceed the maximum size
 */
function truncatePayloads(eventData: ApiEventData): {
  requestPayload: unknown | null;
  responsePayload: unknown | null;
  requestPayloadSize: number | null;
  responsePayloadSize: number | null;
} {
  let requestPayload = eventData.requestPayload;
  let responsePayload = eventData.responsePayload;
  const requestPayloadSize = eventData.requestPayloadSize || null;
  const responsePayloadSize = eventData.responsePayloadSize || null;

  // Truncate request payload if needed
  if (requestPayload && requestPayloadSize && requestPayloadSize > MAX_PAYLOAD_SIZE) {
    requestPayload = truncateJson(requestPayload, MAX_PAYLOAD_SIZE);
  }

  // Truncate response payload if needed
  if (responsePayload && responsePayloadSize && responsePayloadSize > MAX_PAYLOAD_SIZE) {
    responsePayload = truncateJson(responsePayload, MAX_PAYLOAD_SIZE);
  }

  return {
    requestPayload,
    responsePayload,
    requestPayloadSize,
    responsePayloadSize,
  };
}

/**
 * Truncates a JSON object to fit within the size limit
 */
function truncateJson(payload: unknown, maxSize: number): unknown {
  const jsonString = JSON.stringify(payload);
  if (jsonString.length <= maxSize) {
    return payload;
  }

  // Truncate string and try to parse back
  const truncated = jsonString.substring(0, maxSize);
  try {
    // Try to close any open strings or objects
    return JSON.parse(truncated + '"}');
  } catch {
    // If parsing fails, return a truncation indicator
    return { _truncated: true, _originalSize: jsonString.length };
  }
}

/**
 * Determines the payload truncation flag
 */
function determinePayloadTruncation(
  requestSize: number | undefined | null,
  responseSize: number | undefined | null,
  maxSize: number
): string | null {
  const requestTruncated = requestSize && requestSize > maxSize;
  const responseTruncated = responseSize && responseSize > maxSize;

  if (requestTruncated && responseTruncated) return 'both';
  if (requestTruncated) return 'request';
  if (responseTruncated) return 'response';
  return null;
}
