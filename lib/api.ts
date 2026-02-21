import type { AuthProvider } from './params';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://api.mysocial.network';

export interface ProviderCallbackRequest {
  provider: AuthProvider;
  code: string;
  code_challenge: string;
  redirect_uri: string;
  client_id: string;
  state: string;
  nonce: string;
  request_id?: string;
}

export interface ProviderCallbackResponse {
  code: string;
}

export async function exchangeProviderCode(
  body: ProviderCallbackRequest
): Promise<ProviderCallbackResponse> {
  const url = `${API_BASE.replace(/\/$/, '')}/auth/provider/callback`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

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
