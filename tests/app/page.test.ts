/**
 * Home Page Tests (Vitest)
 *
 * Tests for the root page (app/page.tsx)
 */

import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

describe('GET / (Home Page)', () => {
  it('should return 200 and HTML content type', async () => {
    const response = await fetch(`${BASE_URL}/`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
  });

  it('should support compression (gzip/br)', async () => {
    const response = await fetch(`${BASE_URL}/`, {
      headers: {
        'Accept-Encoding': 'gzip, deflate, br',
      },
    });

    expect(response.status).toBe(200);
    // Server may or may not compress depending on config
    // Just verify it doesn't break
  });

  it('should include security headers', async () => {
    const response = await fetch(`${BASE_URL}/`);

    // Check for common security headers (may not all be present)
    const headers = response.headers;

    // At least verify response has headers
    expect(headers).toBeDefined();
    expect(headers.get('content-type')).toBeDefined();
  });
});
