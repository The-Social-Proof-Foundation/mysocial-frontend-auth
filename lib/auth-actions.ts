'use server';

import { getAuthState } from './state';
import type { LoginParams } from './params';

export async function getPendingAuthParams(): Promise<LoginParams | null> {
  const authState = await getAuthState();
  if (!authState || authState.provider !== 'none') {
    return null;
  }
  return authState;
}
