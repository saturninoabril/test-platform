/**
 * Sign In Page Tests (Vitest)
 *
 * Tests for the sign in page (app/auth/signin/page.tsx)
 */

import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

describe('GET /auth/signin (Sign In Page)', () => {
  it('should return 200 and HTML content type', async () => {
    const response = await fetch(`${BASE_URL}/auth/signin`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
  });

  it('should contain signin page elements', async () => {
    const response = await fetch(`${BASE_URL}/auth/signin`);
    const html = await response.text();

    // Verify it's the signin page (case-insensitive)
    expect(html.toLowerCase()).toContain('sign in');
  });
});
