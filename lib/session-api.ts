/**
 * Session API for MySocial wallet auth flow.
 * Consumers (e.g. mysocial-auth) use these to refresh tokens and logout.
 * Backend limits /auth/refresh (e.g. 10/min per IP); debounce/avoid parallel refreshes.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://salt.testnet.mysocial.network';

export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export class SessionRevokedError extends Error {
  constructor(message = 'Session revoked or invalid. Please sign in again.') {
    super(message);
    this.name = 'SessionRevokedError';
  }
}

export class SessionRateLimitedError extends Error {
  constructor(message = 'Too many refresh requests. Please try again later.') {
    super(message);
    this.name = 'SessionRateLimitedError';
  }
}

/**
 * Refresh the session. Returns new access_token, refresh_token, expires_in.
 * On 401: throws SessionRevokedError (clear tokens, redirect to login).
 * On 429: throws SessionRateLimitedError (retry with backoff).
 */
export async function refreshSession(refreshToken: string): Promise<RefreshResponse> {
  const url = `${API_BASE.replace(/\/$/, '')}/auth/refresh`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (res.status === 401) {
    throw new SessionRevokedError();
  }
  if (res.status === 429) {
    throw new SessionRateLimitedError();
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Refresh failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as RefreshResponse;
  if (!data.access_token || !data.refresh_token || data.expires_in == null) {
    throw new Error('Invalid refresh response: missing tokens');
  }
  return data;
}

/**
 * Logout and invalidate the refresh token server-side.
 * Call with stored refresh_token before clearing local tokens.
 */
export async function logoutSession(refreshToken: string): Promise<void> {
  const url = `${API_BASE.replace(/\/$/, '')}/auth/logout`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(`Logout failed: ${res.status} ${text}`);
  }
}

/**
 * Build Authorization header for authenticated API requests (e.g. /salt).
 */
export function getAuthHeaders(sessionAccessToken: string): { Authorization: string } {
  return { Authorization: `Bearer ${sessionAccessToken}` };
}
