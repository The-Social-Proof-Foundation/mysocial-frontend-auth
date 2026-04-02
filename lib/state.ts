import { getIronSession, type IronSession } from 'iron-session';
import { cookies } from 'next/headers';
import type { LoginParams } from './params';

const COOKIE_NAME = 'auth_state';
const MAX_AGE = 60 * 10; // 10 minutes

/** Set `AUTH_DEBUG=1` in .env to log auth diagnostics (or use dev; no secrets logged). */
export function authDebugEnabled(): boolean {
  const v = process.env.AUTH_DEBUG?.trim().toLowerCase();
  return process.env.NODE_ENV === 'development' || v === '1' || v === 'true' || v === 'yes';
}

export function authDebugLog(tag: string, payload: Record<string, unknown>): void {
  if (!authDebugEnabled()) return;
  console.log(`[auth-debug] ${tag}`, payload);
}

export type AuthState = LoginParams;

export interface SessionData {
  authState: AuthState | null;
}

function getSessionOptions() {
  const secret = process.env.AUTH_STATE_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_STATE_SECRET must be set and at least 32 characters');
  }
  return {
    password: secret,
    cookieName: COOKIE_NAME,
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: MAX_AGE,
      sameSite: 'lax' as const,
      path: '/',
    },
  };
}

export async function getAuthSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME);
  authDebugLog('getAuthSession:before-iron', {
    hasRawCookie: Boolean(raw?.value),
    rawCookieLength: raw?.value?.length ?? 0,
  });
  const session = await getIronSession<SessionData>(
    cookieStore,
    getSessionOptions()
  );
  if (!session.authState) {
    session.authState = null;
  }
  authDebugLog('getAuthSession:after-iron', {
    hasAuthState: session.authState != null,
    provider: session.authState?.provider ?? null,
    stateLen: session.authState?.state?.length ?? 0,
  });
  return session;
}

export async function setAuthState(state: AuthState): Promise<void> {
  const session = await getAuthSession();
  session.authState = state;
  await session.save();
  authDebugLog('setAuthState:saved', {
    provider: state.provider,
    statePrefix: state.state?.slice(0, 8) ?? '',
    redirectHost: (() => {
      try {
        return new URL(state.redirect_uri).host;
      } catch {
        return 'invalid-url';
      }
    })(),
  });
}

export async function getAuthState(): Promise<AuthState | null> {
  const session = await getAuthSession();
  return session.authState;
}

export async function clearAuthState(): Promise<void> {
  const session = await getAuthSession();
  session.authState = null;
  await session.save();
}
