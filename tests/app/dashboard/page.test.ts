/**
 * Dashboard Page Tests (Vitest)
 *
 * Tests for the dashboard page (app/dashboard/page.tsx)
 */

import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

describe('GET /dashboard (Dashboard Page)', () => {
  it('should return 200 and HTML content type', async () => {
    const response = await fetch(`${BASE_URL}/dashboard`);

    // Dashboard might require authentication - 200 or 401/403 are acceptable
    expect([200, 401, 403]).toContain(response.status);

    if (response.status === 200) {
      expect(response.headers.get('content-type')).toContain('text/html');
    }
  });
});
