'use server';

import { redirect } from 'next/navigation';
import { parseLoginParams } from '@/lib/params';
import { setAuthState } from '@/lib/state';
import { buildProviderAuthUrl } from '@/lib/providers';

export async function initLogin(searchParams: URLSearchParams) {
  const parsed = parseLoginParams(searchParams);
  if (!parsed.success) {
    redirect(
      `/error?reason=invalid_params&message=${encodeURIComponent(parsed.error)}`
    );
  }

  const { params: loginParams } = parsed;
  const providerUrl = buildProviderAuthUrl(
    loginParams.provider,
    loginParams.state,
    loginParams.code_challenge
  );

  if (!providerUrl) {
    redirect(
      `/error?reason=provider_not_configured&provider=${loginParams.provider}`
    );
  }

  await setAuthState(loginParams);
  return { providerUrl };
}
