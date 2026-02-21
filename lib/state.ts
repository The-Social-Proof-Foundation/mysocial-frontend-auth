import { getIronSession, type IronSession } from 'iron-session';
import { cookies } from 'next/headers';
import type { LoginParams } from './params';

const COOKIE_NAME = 'auth_state';
const MAX_AGE = 60 * 10; // 10 minutes

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
  const session = await getIronSession<SessionData>(
    cookieStore,
    getSessionOptions()
  );
  if (!session.authState) {
    session.authState = null;
  }
  return session;
}

export async function setAuthState(state: AuthState): Promise<void> {
  const session = await getAuthSession();
  session.authState = state;
  await session.save();
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
