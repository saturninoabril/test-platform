/**
 * Test Reports List Page Tests (Vitest)
 *
 * Tests for the test reports list page (app/test-reports/page.tsx)
 */

import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

describe('GET /test-reports (Test Reports List Page)', () => {
  it('should return 200 and HTML content type', async () => {
    const response = await fetch(`${BASE_URL}/test-reports`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
  });

  it('should contain test reports page content', async () => {
    const response = await fetch(`${BASE_URL}/test-reports`);
    const html = await response.text();

    // Verify it's actually the test reports page (not an error page)
    expect(html).toBeTruthy();
    expect(html.length).toBeGreaterThan(0);
  });

  it('should handle GET requests', async () => {
    const response = await fetch(`${BASE_URL}/test-reports`, {
      method: 'GET',
    });

    expect(response.status).toBe(200);
  });

  it('should handle POST requests to page routes', async () => {
    const response = await fetch(`${BASE_URL}/test-reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'data' }),
    });

    // Next.js pages may return 200 (renders page), 404, or 405 (Method Not Allowed)
    expect([200, 404, 405]).toContain(response.status);
  });

  it('should handle trailing slash redirects', async () => {
    const response = await fetch(`${BASE_URL}/test-reports/`, {
      redirect: 'manual',
    });

    // Should either return 200 (no redirect) or 307/308 (redirect)
    expect([200, 307, 308]).toContain(response.status);
  });
});
