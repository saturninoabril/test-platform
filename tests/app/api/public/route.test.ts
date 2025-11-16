/**
 * Public API Endpoint Tests (Vitest)
 *
 * Tests for the public API endpoint (app/api/public/route.ts)
 */

import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

describe('GET /api/public', () => {
  it('should return 200 and JSON content type', async () => {
    const response = await fetch(`${BASE_URL}/api/public`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
  });
});
