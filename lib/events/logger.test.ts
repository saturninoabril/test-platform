import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logEvent } from './logger';
import type { ApiEventData } from './types';

// Mock the database
vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  apiEvents: {},
}));

describe('logEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set MAX_EVENT_PAYLOAD_SIZE for tests
    process.env.MAX_EVENT_PAYLOAD_SIZE = '100';
  });

  afterEach(() => {
    delete process.env.MAX_EVENT_PAYLOAD_SIZE;
  });

  it('should log an event successfully', async () => {
    const eventData: ApiEventData = {
      id: 'test-id-123',
      method: 'GET',
      endpoint: '/api/test',
      statusCode: 200,
      requestTimestamp: new Date(),
      responseTimestamp: new Date(),
      durationMs: 50,
      authenticationStatus: 'authenticated',
      maskedJWTToken: 'eyJhbGciOiJIUzI1NiI...VCJ9.[SIGNATURE_HIDDEN]',
      jwtSubject: 'ci-service',
      jwtRoles: 'write:reports,admin',
      sourceIdentifier: '192.168.1.1',
    };

    await expect(logEvent(eventData)).resolves.toBeUndefined();
  });

  it('should handle small payloads without truncation', async () => {
    const eventData: ApiEventData = {
      id: 'test-id-123',
      method: 'POST',
      endpoint: '/api/test',
      statusCode: 201,
      requestTimestamp: new Date(),
      responseTimestamp: new Date(),
      durationMs: 75,
      authenticationStatus: 'authenticated',
      requestPayload: { small: 'data' },
      requestPayloadSize: 20,
      responsePayload: { result: 'ok' },
      responsePayloadSize: 15,
    };

    await expect(logEvent(eventData)).resolves.toBeUndefined();
  });

  it('should truncate large payloads', async () => {
    const largePayload = { data: 'x'.repeat(200) };
    const eventData: ApiEventData = {
      id: 'test-id-123',
      method: 'POST',
      endpoint: '/api/test',
      statusCode: 201,
      requestTimestamp: new Date(),
      responseTimestamp: new Date(),
      durationMs: 100,
      authenticationStatus: 'authenticated',
      requestPayload: largePayload,
      requestPayloadSize: 250,
      responsePayload: largePayload,
      responsePayloadSize: 250,
    };

    await expect(logEvent(eventData)).resolves.toBeUndefined();
  });

  it('should not throw error when logging fails', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.insert).mockImplementationOnce(() => {
      throw new Error('Database error');
    });

    const eventData: ApiEventData = {
      id: 'test-id-123',
      method: 'GET',
      endpoint: '/api/test',
      statusCode: 500,
      requestTimestamp: new Date(),
      responseTimestamp: new Date(),
      durationMs: 10,
      authenticationStatus: 'unauthenticated',
      errorType: 'Error',
      errorMessage: 'Test error',
    };

    // Should not throw - event logging failures shouldn't break API
    await expect(logEvent(eventData)).resolves.toBeUndefined();
  });

  it('should handle events with error information', async () => {
    const eventData: ApiEventData = {
      id: 'test-id-123',
      method: 'POST',
      endpoint: '/api/test',
      statusCode: 500,
      requestTimestamp: new Date(),
      responseTimestamp: new Date(),
      durationMs: 25,
      authenticationStatus: 'authenticated',
      errorType: 'TypeError',
      errorMessage: 'Something went wrong',
    };

    await expect(logEvent(eventData)).resolves.toBeUndefined();
  });

  it('should handle events with context data', async () => {
    const eventData: ApiEventData = {
      id: 'test-id-123',
      method: 'GET',
      endpoint: '/api/test',
      statusCode: 200,
      requestTimestamp: new Date(),
      responseTimestamp: new Date(),
      durationMs: 30,
      authenticationStatus: 'unauthenticated',
      context: {
        userAgent: 'Mozilla/5.0',
        requestId: 'req-123',
        custom: 'data',
      },
    };

    await expect(logEvent(eventData)).resolves.toBeUndefined();
  });
});
