'use client';

/**
 * Session client for consumers (e.g. mysocial-auth).
 * Holds session tokens, provides refreshIfNeeded and logout.
 * Backend limits /auth/refresh (~10/min per IP); avoid rapid repeated calls.
 */

import {
  refreshSession,
  logoutSession,
  getAuthHeaders,
  type RefreshResponse,
  SessionRevokedError,
  SessionRateLimitedError,
} from './session-api';

const REFRESH_BUFFER_MS = 2 * 60 * 1000; // 2 minutes before expiry

export { SessionRevokedError, SessionRateLimitedError };

export interface SessionTokens {
  session_access_token: string;
  refresh_token: string;
  expires_in: number;
}

/**
 * Create SessionClient from MYSOCIAL_AUTH_RESULT payload.
 */
export function createSessionClient(tokens: SessionTokens): SessionClient {
  const expiresAt = Date.now() + tokens.expires_in * 1000;
  return new SessionClient(
    tokens.session_access_token,
    tokens.refresh_token,
    expiresAt
  );
}

export class SessionClient {
  private sessionAccessToken: string;
  private refreshToken: string;
  private expiresAt: number;

  constructor(
    sessionAccessToken: string,
    refreshToken: string,
    expiresAt: number
  ) {
    this.sessionAccessToken = sessionAccessToken;
    this.refreshToken = refreshToken;
    this.expiresAt = expiresAt;
  }

  /**
   * If token is expired or within 2 min of expiry, refresh and return new tokens.
   * Returns null if token is still valid.
   * Throws SessionRevokedError on 401; SessionRateLimitedError on 429.
   */
  async refreshIfNeeded(): Promise<RefreshResponse | null> {
    if (Date.now() < this.expiresAt - REFRESH_BUFFER_MS) {
      return null;
    }
    const result = await refreshSession(this.refreshToken);
    this.sessionAccessToken = result.access_token;
    this.refreshToken = result.refresh_token;
    this.expiresAt = Date.now() + result.expires_in * 1000;
    return result;
  }

  /**
   * Call logout endpoint and invalidate refresh token server-side.
   * Caller should clear stored tokens and redirect to login after.
   */
  async logout(): Promise<void> {
    await logoutSession(this.refreshToken);
  }

  getSessionAccessToken(): string {
    return this.sessionAccessToken;
  }

  getRefreshToken(): string {
    return this.refreshToken;
  }

  getExpiresAt(): number {
    return this.expiresAt;
  }

  /** Authorization header for /salt and other protected endpoints. */
  getAuthHeaders(): { Authorization: string } {
    return getAuthHeaders(this.sessionAccessToken);
  }
}
