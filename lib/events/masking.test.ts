import { describe, it, expect } from 'vitest';
import { maskSensitiveHeader, maskJwtToken, extractJwtTokenDetails } from './masking';

describe('maskSensitiveHeader', () => {
  it('should mask a header value by showing only the first character', () => {
    const result = maskSensitiveHeader('fPTcpNiqZxglibsgoKF_ecCKQwem50O8lIEdUCKOLgM');
    expect(result).toBe('f...');
  });

  it('should return [MASKED] for empty string', () => {
    const result = maskSensitiveHeader('');
    expect(result).toBe('[MASKED]');
  });

  it('should handle single character strings', () => {
    const result = maskSensitiveHeader('a');
    expect(result).toBe('a...');
  });

  it('should handle multi-character strings correctly', () => {
    const result = maskSensitiveHeader('secret123');
    expect(result).toBe('s...');
  });
});

describe('maskJwtToken', () => {
  it('should mask a valid JWT token', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwibmFtZSI6IkpvaG4ifQ.signature123';
    const result = maskJwtToken(jwt);

    // Should show first 20 chars and last 4 chars of header.payload
    expect(result).toContain('eyJhbGciOiJIUzI1NiIs');
    expect(result).toContain('.[SIGNATURE_HIDDEN]');
    expect(result).not.toContain('signature123');
  });

  it('should handle non-JWT tokens with simple masking', () => {
    const token = 'simple-token-123';
    const result = maskJwtToken(token);
    expect(result).toBe('s...');
  });

  it('should handle empty tokens', () => {
    const result = maskJwtToken('');
    expect(result).toBe('[MASKED]');
  });
});

describe('extractJwtTokenDetails', () => {
  it('should extract JWT token details with subject and roles', () => {
    const headers = new Headers();
    // JWT with payload: {"sub":"ci-service","roles":["write:reports","admin"]}
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjaS1zZXJ2aWNlIiwicm9sZXMiOlsid3JpdGU6cmVwb3J0cyIsImFkbWluIl19.signature';
    headers.set('authorization', `Bearer ${jwt}`);

    const result = extractJwtTokenDetails(headers);

    expect(result.maskedToken).toContain('eyJhbGciOiJIUzI1NiIs');
    expect(result.maskedToken).toContain('.[SIGNATURE_HIDDEN]');
    expect(result.subject).toBe('ci-service');
    expect(result.roles).toBe('write:reports,admin');
  });

  it('should extract JWT token details with subject only', () => {
    const headers = new Headers();
    // JWT with payload: {"sub":"user-123"}
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.signature';
    headers.set('authorization', `Bearer ${jwt}`);

    const result = extractJwtTokenDetails(headers);

    expect(result.maskedToken).toBeDefined();
    expect(result.subject).toBe('user-123');
    expect(result.roles).toBeNull();
  });

  it('should return null values when no authorization header present', () => {
    const headers = new Headers();

    const result = extractJwtTokenDetails(headers);

    expect(result.maskedToken).toBeNull();
    expect(result.subject).toBeNull();
    expect(result.roles).toBeNull();
  });

  it('should return null values when authorization header is not Bearer', () => {
    const headers = new Headers();
    headers.set('authorization', 'Basic dXNlcjpwYXNz');

    const result = extractJwtTokenDetails(headers);

    expect(result.maskedToken).toBeNull();
    expect(result.subject).toBeNull();
    expect(result.roles).toBeNull();
  });

  it('should handle invalid JWT tokens gracefully', () => {
    const headers = new Headers();
    headers.set('authorization', 'Bearer invalid-token');

    const result = extractJwtTokenDetails(headers);

    expect(result.maskedToken).toBe('i...');
    expect(result.subject).toBeNull();
    expect(result.roles).toBeNull();
  });

  it('should handle JWT with empty roles array', () => {
    const headers = new Headers();
    // JWT with payload: {"sub":"test","roles":[]}
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0Iiwicm9sZXMiOltdfQ.signature';
    headers.set('authorization', `Bearer ${jwt}`);

    const result = extractJwtTokenDetails(headers);

    expect(result.subject).toBe('test');
    expect(result.roles).toBeNull();
  });
});
