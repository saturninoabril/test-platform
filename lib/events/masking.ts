// Header Masking Utilities

/**
 * Masks a sensitive header value by showing only the first character
 * @param value - The header value to mask
 * @returns Masked string in format "f..." or "[MASKED]" if empty
 */
export function maskSensitiveHeader(value: string): string {
  if (value.length === 0) return '[MASKED]';
  const firstChar = value.substring(0, 1);
  return `${firstChar}...`;
}

/**
 * Masks a JWT token by showing header.payload prefix and suffix but hiding the signature
 * @param token - JWT token (format: header.payload.signature)
 * @returns Masked JWT showing first 20 and last 4 chars of header.payload
 */
export function maskJwtToken(token: string): string {
  if (token.length === 0) return '[MASKED]';

  // JWT format: header.payload.signature
  const parts = token.split('.');

  if (parts.length === 3) {
    // Valid JWT structure - show beginning of header.payload and hide signature completely
    const headerPayload = `${parts[0]}.${parts[1]}`;
    const prefix = headerPayload.substring(0, Math.min(20, headerPayload.length));
    const suffix = headerPayload.substring(Math.max(0, headerPayload.length - 4));
    return `${prefix}...${suffix}.[SIGNATURE_HIDDEN]`;
  }

  // Not a valid JWT format - use simple masking
  return maskSensitiveHeader(token);
}

/**
 * JWT token details extracted from the token
 */
export interface JwtTokenDetails {
  maskedToken: string | null;
  subject: string | null;
  roles: string | null;
}

/**
 * Decodes a JWT token payload without verification (for logging purposes only)
 * @param token - JWT token
 * @returns Decoded payload or null if invalid
 */
function decodeJwtPayload(token: string): { sub?: string; roles?: string[] } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Decode the payload (second part)
    const payload = parts[1];
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Extracts JWT token details (masked token, subject, roles) from request headers
 * @param headers - Next.js request headers
 * @returns JWT token details with masked token and decoded claims
 */
export function extractJwtTokenDetails(headers: Headers): JwtTokenDetails {
  const authHeader = headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      maskedToken: null,
      subject: null,
      roles: null,
    };
  }

  const token = authHeader.substring(7);
  const maskedToken = maskJwtToken(token);

  // Decode JWT payload to extract subject and roles (for logging only)
  const payload = decodeJwtPayload(token);

  return {
    maskedToken,
    subject: payload?.sub || null,
    roles: payload?.roles && payload.roles.length > 0 ? payload.roles.join(',') : null,
  };
}
