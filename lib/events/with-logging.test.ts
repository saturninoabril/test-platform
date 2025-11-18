import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { withEventLogging } from './with-logging';

// Mock the logger
vi.mock('./logger', () => ({
  logEvent: vi.fn().mockResolvedValue(undefined),
}));

// Mock the masking module
vi.mock('./masking', () => ({
  extractAndMaskAuthToken: vi.fn(() => 'a...'),
  extractJwtTokenDetails: vi.fn(() => ({
    maskedToken: 'eyJhbGciOiJIUzI1NiI...VCJ9.[SIGNATURE_HIDDEN]',
    subject: 'test-service',
    roles: 'admin,read:events',
  })),
}));

describe('withEventLogging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should wrap a handler and log the request/response', async () => {
    const handler = async () => {
      return NextResponse.json({ success: true });
    };

    const wrappedHandler = withEventLogging(handler);
    const request = new NextRequest('http://localhost:3001/api/test');

    const response = await wrappedHandler(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true });

    // Verify logEvent was called
    const { logEvent } = await import('./logger');
    expect(logEvent).toHaveBeenCalledOnce();
  });

  it('should capture error information when handler throws', async () => {
    const handler = async () => {
      throw new Error('Test error');
    };

    const wrappedHandler = withEventLogging(handler);
    const request = new NextRequest('http://localhost:3001/api/test');

    await expect(wrappedHandler(request)).rejects.toThrow('Test error');

    // Verify logEvent was still called with error details
    const { logEvent } = await import('./logger');
    expect(logEvent).toHaveBeenCalledOnce();
    const eventData = vi.mocked(logEvent).mock.calls[0][0];
    expect(eventData.errorType).toBe('Error');
    expect(eventData.errorMessage).toBe('Test error');
  });

  it('should determine authentication status correctly', async () => {
    const handler = async () => {
      return NextResponse.json({ success: true });
    };

    const wrappedHandler = withEventLogging(handler);
    const request = new NextRequest('http://localhost:3001/api/test', {
      headers: {
        authorization: 'Bearer test-jwt-token',
      },
    });

    await wrappedHandler(request);

    const { logEvent } = await import('./logger');
    const eventData = vi.mocked(logEvent).mock.calls[0][0];
    expect(eventData.authenticationStatus).toBe('authenticated');
  });

  it('should mark as auth_failed when status is 401', async () => {
    const handler = async () => {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    };

    const wrappedHandler = withEventLogging(handler);
    const request = new NextRequest('http://localhost:3001/api/test', {
      headers: {
        'x-api-key': 'invalid-key',
      },
    });

    await wrappedHandler(request);

    const { logEvent } = await import('./logger');
    const eventData = vi.mocked(logEvent).mock.calls[0][0];
    expect(eventData.authenticationStatus).toBe('auth_failed');
  });

  it('should capture request payload for JSON content-type', async () => {
    const handler = async () => {
      // Handler doesn't consume the body, so logging can capture it
      return NextResponse.json({ success: true });
    };

    const wrappedHandler = withEventLogging(handler);
    const request = new NextRequest('http://localhost:3001/api/test', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ test: 'data' }),
    });

    await wrappedHandler(request);

    const { logEvent } = await import('./logger');
    const eventData = vi.mocked(logEvent).mock.calls[0][0];
    expect(eventData.requestPayload).toEqual({ test: 'data' });
    expect(eventData.requestPayloadSize).toBeGreaterThan(0);
  });

  it('should NOT capture request payload for non-JSON content-type', async () => {
    const handler = async () => {
      return NextResponse.json({ success: true });
    };

    const wrappedHandler = withEventLogging(handler);
    const request = new NextRequest('http://localhost:3001/api/test', {
      method: 'POST',
      headers: {
        'content-type': 'multipart/form-data',
      },
      body: 'file content here',
    });

    await wrappedHandler(request);

    const { logEvent } = await import('./logger');
    const eventData = vi.mocked(logEvent).mock.calls[0][0];
    expect(eventData.requestPayload).toBeNull();
    expect(eventData.requestPayloadSize).toBeGreaterThan(0); // Size is still recorded
  });

  it('should capture response payload for JSON responses', async () => {
    const handler = async () => {
      return NextResponse.json({ result: 'success' });
    };

    const wrappedHandler = withEventLogging(handler);
    const request = new NextRequest('http://localhost:3001/api/test');

    await wrappedHandler(request);

    const { logEvent } = await import('./logger');
    const eventData = vi.mocked(logEvent).mock.calls[0][0];
    expect(eventData.responsePayload).toEqual({ result: 'success' });
  });

  it('should capture source identifier from headers', async () => {
    const handler = async () => {
      return NextResponse.json({ success: true });
    };

    const wrappedHandler = withEventLogging(handler);
    const request = new NextRequest('http://localhost:3001/api/test', {
      headers: {
        'x-forwarded-for': '192.168.1.100, 10.0.0.1',
      },
    });

    await wrappedHandler(request);

    const { logEvent } = await import('./logger');
    const eventData = vi.mocked(logEvent).mock.calls[0][0];
    expect(eventData.sourceIdentifier).toBe('192.168.1.100');
  });

  it('should capture duration in milliseconds', async () => {
    const handler = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return NextResponse.json({ success: true });
    };

    const wrappedHandler = withEventLogging(handler);
    const request = new NextRequest('http://localhost:3001/api/test');

    await wrappedHandler(request);

    const { logEvent } = await import('./logger');
    const eventData = vi.mocked(logEvent).mock.calls[0][0];
    // Just verify duration is captured as a positive number (timing can vary in CI)
    expect(eventData.durationMs).toBeGreaterThan(0);
    expect(typeof eventData.durationMs).toBe('number');
  });

  it('should continue even if logEvent fails', async () => {
    const { logEvent } = await import('./logger');
    vi.mocked(logEvent).mockRejectedValueOnce(new Error('Logging failed'));

    const handler = async () => {
      return NextResponse.json({ success: true });
    };

    const wrappedHandler = withEventLogging(handler);
    const request = new NextRequest('http://localhost:3001/api/test');

    const response = await wrappedHandler(request);
    expect(response.status).toBe(200);
  });
});
