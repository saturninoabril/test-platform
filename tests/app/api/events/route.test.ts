/**
 * Events API Route Tests (Vitest)
 *
 * Tests for API events listing endpoint (app/api/events/route.ts)
 *
 * Tests GET /api/events with:
 * - Authentication and authorization
 * - Query filtering (endpoint, method, statusCode, dates)
 * - Pagination
 * - Sorting
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { sign } from 'jsonwebtoken';
import { setupTestDatabase } from '../../../helpers/test-database';

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

describe('GET /api/events', () => {
  describe('Authentication & Authorization', () => {
    it('should return 401 without authentication', async () => {
      const response = await fetch(`${BASE_URL}/api/events`);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    it('should return 403 without admin role', async () => {
      const token = generateToken('user-123', ['write:reports', 'read:events']);
      const response = await fetch(`${BASE_URL}/api/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.status).toBe(403);
    });

    it('should return 200 with admin role', async () => {
      const token = generateToken('admin-123', ['admin']);
      const response = await fetch(`${BASE_URL}/api/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.status).toBe(200);
    });
  });

  describe('Response Structure', () => {
    it('should return events list with pagination', async () => {
      const token = generateToken('admin-123', ['admin']);
      const response = await fetch(`${BASE_URL}/api/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('pagination');
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toHaveProperty('page');
      expect(data.pagination).toHaveProperty('pageSize');
      expect(data.pagination).toHaveProperty('totalPages');
      expect(data.pagination).toHaveProperty('totalCount');
    });
  });

  describe('Filtering', () => {
    it('should filter by endpoint', async () => {
      const token = generateToken('admin-123', ['admin']);
      const response = await fetch(`${BASE_URL}/api/events?endpoint=/api/test-reports`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.status).toBe(200);
    });

    it('should filter by method', async () => {
      const token = generateToken('admin-123', ['admin']);
      const response = await fetch(`${BASE_URL}/api/events?method=GET`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.status).toBe(200);
    });

    it('should filter by status code', async () => {
      const token = generateToken('admin-123', ['admin']);
      const response = await fetch(`${BASE_URL}/api/events?statusCode=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.status).toBe(200);
    });

    it('should filter by date range', async () => {
      const token = generateToken('admin-123', ['admin']);
      const startDate = new Date('2025-01-01').toISOString();
      const endDate = new Date('2025-12-31').toISOString();
      const response = await fetch(
        `${BASE_URL}/api/events?startDate=${startDate}&endDate=${endDate}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      expect(response.status).toBe(200);
    });

    it('should filter by authentication status', async () => {
      const token = generateToken('admin-123', ['admin']);
      const response = await fetch(`${BASE_URL}/api/events?authenticationStatus=authenticated`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.status).toBe(200);
    });
  });

  describe('Pagination', () => {
    it('should accept page parameter', async () => {
      const token = generateToken('admin-123', ['admin']);
      const response = await fetch(`${BASE_URL}/api/events?page=2`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.pagination.page).toBe(2);
    });

    it('should accept pageSize parameter', async () => {
      const token = generateToken('admin-123', ['admin']);
      const response = await fetch(`${BASE_URL}/api/events?pageSize=10`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.pagination.pageSize).toBe(10);
    });
  });

  describe('Sorting', () => {
    it('should accept sortBy parameter', async () => {
      const token = generateToken('admin-123', ['admin']);
      const response = await fetch(`${BASE_URL}/api/events?sortBy=statusCode`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.status).toBe(200);
    });

    it('should accept sortOrder parameter', async () => {
      const token = generateToken('admin-123', ['admin']);
      const response = await fetch(`${BASE_URL}/api/events?sortBy=createdAt&sortOrder=asc`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.status).toBe(200);
    });

    it('should default to createdAt desc when no sort params', async () => {
      const token = generateToken('admin-123', ['admin']);
      const response = await fetch(`${BASE_URL}/api/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.status).toBe(200);
      const data = await response.json();
      // If there are multiple events, verify sorting
      if (data.data.length > 1) {
        const dates = data.data.map((e: { createdAt: string }) => new Date(e.createdAt).getTime());
        const sortedDates = [...dates].sort((a, b) => b - a);
        expect(dates).toEqual(sortedDates);
      }
    });
  });
});
