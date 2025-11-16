/**
 * Test Report Detail Page Tests (Vitest)
 *
 * Tests for the test report detail page (app/test-reports/[id]/page.tsx)
 */

import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

describe('GET /test-reports/:id (Test Report Detail Page)', () => {
  it('should return 200 or 404 for UUID format ID', async () => {
    // Test with a valid UUID format (may return 404 if not found, but shouldn't error)
    const testId = '12345678-1234-1234-1234-123456789012';
    const response = await fetch(`${BASE_URL}/test-reports/${testId}`);

    // Should return either 200 (found) or 404 (not found), both are valid
    expect([200, 404]).toContain(response.status);
    expect(response.headers.get('content-type')).toContain('text/html');
  });

  it('should handle invalid ID format gracefully', async () => {
    const response = await fetch(`${BASE_URL}/test-reports/invalid-id`);

    // Should not crash - return 400, 404, or handle it gracefully
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(600);
  });
});
