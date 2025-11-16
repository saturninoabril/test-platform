/**
 * Event Detail API Route Tests (Vitest)
 *
 * Tests for single event endpoint (app/api/events/[id]/route.ts)
 *
 * Tests GET /api/events/:id with:
 * - Authentication and authorization
 * - Valid UUID format
 * - Event existence validation
 * - Event retrieval
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { sign } from 'jsonwebtoken';
import { setupTestDatabase, createCommittedTestDatabase } from '../../../../helpers/test-database';
import * as schema from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

// Helper to generate JWT token
function generateToken(subject: string, roles: string[]): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');
  return sign({ sub: subject, roles, iss: 'test-platform' }, secret, { expiresIn: '1h' });
}

// Setup test database with transaction-based isolation
const testDb = setupTestDatabase();

beforeAll(testDb.beforeAll);
beforeEach(testDb.beforeEach);
afterEach(testDb.afterEach);
afterAll(testDb.afterAll);

describe('GET /api/events/:id', () => {
  describe('Authentication & Authorization', () => {
    it('should return 401 without authentication', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const response = await fetch(`${BASE_URL}/api/events/${validUuid}`);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    it('should return 403 without admin role', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const token = generateToken('user-123', ['write:reports', 'read:events']);
      const response = await fetch(`${BASE_URL}/api/events/${validUuid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.status).toBe(403);
    });

    it('should allow access with admin role', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const token = generateToken('admin-123', ['admin']);
      const response = await fetch(`${BASE_URL}/api/events/${validUuid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Should not be 403 (might be 404 if event doesn't exist)
      expect(response.status).not.toBe(403);
    });
  });

  describe('ID Validation', () => {
    it('should return 400 for invalid UUID format', async () => {
      const token = generateToken('admin-123', ['admin']);
      const response = await fetch(`${BASE_URL}/api/events/invalid-uuid`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('code', 'INVALID_ID_FORMAT');
      expect(data.message).toContain('UUID');
    });

    it('should return 400 for numeric ID', async () => {
      const token = generateToken('admin-123', ['admin']);
      const response = await fetch(`${BASE_URL}/api/events/12345`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('code', 'INVALID_ID_FORMAT');
    });

    it('should handle empty ID gracefully', async () => {
      const token = generateToken('admin-123', ['admin']);
      const response = await fetch(`${BASE_URL}/api/events/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // This redirects to /api/events (list endpoint) and returns 200 with admin auth
      // Or might return 404/405 depending on routing
      expect([200, 404, 405]).toContain(response.status);
    });
  });

  describe('Event Retrieval', () => {
    it('should return 404 for non-existent event', async () => {
      const token = generateToken('admin-123', ['admin']);
      const nonExistentUuid = '123e4567-e89b-12d3-a456-426614174000';

      const response = await fetch(`${BASE_URL}/api/events/${nonExistentUuid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('code', 'EVENT_NOT_FOUND');
      expect(data.message).toContain(nonExistentUuid);
    });

    it('should return event with valid ID when event exists', async () => {
      const token = generateToken('admin-123', ['admin']);

      // Use committed database connection for data visible to dev server
      const committedDb = await createCommittedTestDatabase();

      try {
        // Create a test event in the database
        const now = new Date();
        const [event] = await committedDb.db
          .insert(schema.apiEvents)
          .values({
            endpoint: '/api/test',
            method: 'GET',
            statusCode: 200,
            durationMs: 100,
            requestTimestamp: now,
            responseTimestamp: new Date(now.getTime() + 100),
            authenticationStatus: 'unauthenticated',
            maskedJWTToken: null,
            jwtSubject: null,
            jwtRoles: null,
            sourceIdentifier: '127.0.0.1',
            errorType: null,
            errorMessage: null,
            requestPayload: null,
            responsePayload: null,
            requestPayloadSize: null,
            responsePayloadSize: null,
            payloadTruncated: null,
            context: null,
          })
          .returning();

        const response = await fetch(`${BASE_URL}/api/events/${event.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toHaveProperty('id', event.id);
        expect(data).toHaveProperty('endpoint', '/api/test');
        expect(data).toHaveProperty('method', 'GET');
        expect(data).toHaveProperty('statusCode', 200);

        // Cleanup: delete the test event
        await committedDb.db.delete(schema.apiEvents).where(eq(schema.apiEvents.id, event.id));
      } finally {
        await committedDb.cleanup();
      }
    });

    it('should return complete event structure', async () => {
      const token = generateToken('admin-123', ['admin']);

      // Use committed database connection for data visible to dev server
      const committedDb = await createCommittedTestDatabase();

      try {
        // Create a test event with more fields
        const now = new Date();
        const [event] = await committedDb.db
          .insert(schema.apiEvents)
          .values({
            endpoint: '/api/test-reports',
            method: 'POST',
            statusCode: 201,
            durationMs: 250,
            requestTimestamp: now,
            responseTimestamp: new Date(now.getTime() + 250),
            authenticationStatus: 'authenticated',
            maskedJWTToken: 'eyJ...[MASKED]',
            jwtSubject: 'user-123',
            jwtRoles: 'write:reports',
            sourceIdentifier: '127.0.0.1',
            errorType: null,
            errorMessage: null,
            requestPayload: { framework: 'playwright' },
            responsePayload: { success: true },
            requestPayloadSize: 50,
            responsePayloadSize: 25,
            payloadTruncated: null,
            context: null,
          })
          .returning();

        const response = await fetch(`${BASE_URL}/api/events/${event.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        expect(response.status).toBe(200);
        const data = await response.json();

        // Verify all expected fields are present
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('endpoint');
        expect(data).toHaveProperty('method');
        expect(data).toHaveProperty('statusCode');
        expect(data).toHaveProperty('durationMs');
        expect(data).toHaveProperty('requestTimestamp');
        expect(data).toHaveProperty('responseTimestamp');
        expect(data).toHaveProperty('authenticationStatus');
        expect(data).toHaveProperty('jwtSubject');
        expect(data).toHaveProperty('jwtRoles');

        // Cleanup: delete the test event
        await committedDb.db.delete(schema.apiEvents).where(eq(schema.apiEvents.id, event.id));
      } finally {
        await committedDb.cleanup();
      }
    });
  });
});
