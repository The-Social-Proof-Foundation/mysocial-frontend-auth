import type { AuthProvider } from './params';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://salt.testnet.mysocial.network';
const AUTH_CALLBACK_PATH =
  process.env.NEXT_PUBLIC_AUTH_CALLBACK_PATH ?? '/auth/provider/callback';

export interface ProviderCallbackRequest {
  provider: AuthProvider;
  code: string;
  code_challenge: string;
  redirect_uri: string;
  client_id: string;
  state: string;
  nonce: string;
  code_verifier?: string;
  request_id?: string;
}

export interface ProviderCallbackResponse {
  code: string;
  salt?: string;
  id_token?: string;
  access_token?: string;
  user?: { address?: string; sub?: string; email?: string; [key: string]: unknown };
}

export async function exchangeProviderCode(
  body: ProviderCallbackRequest
): Promise<ProviderCallbackResponse> {
  const path = AUTH_CALLBACK_PATH.startsWith('/') ? AUTH_CALLBACK_PATH : `/${AUTH_CALLBACK_PATH}`;
  const url = `${API_BASE.replace(/\/$/, '')}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    throw new Error(
      `Backend unreachable (${url}): ${msg}. Verify NEXT_PUBLIC_API_BASE_URL.`
    );
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Provider exchange failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as ProviderCallbackResponse;
  if (!data.code) {
    throw new Error('Invalid response: missing code');
  }
  return data;
}
