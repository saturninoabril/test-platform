/**
 * 404 Not Found Tests (Vitest)
 *
 * Tests for non-existent routes
 */

import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

describe('Non-existent Routes', () => {
  it('should return 404 for non-existent page', async () => {
    const response = await fetch(`${BASE_URL}/non-existent-page-12345`);

    expect(response.status).toBe(404);
    // Should still return HTML (Next.js 404 page)
    expect(response.headers.get('content-type')).toContain('text/html');
  });

  it('should return 404 for non-existent API route', async () => {
    const response = await fetch(`${BASE_URL}/api/non-existent-endpoint`);

    expect(response.status).toBe(404);
  });
});
