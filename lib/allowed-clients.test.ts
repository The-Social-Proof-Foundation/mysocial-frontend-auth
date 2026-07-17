import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAllowedClientsCache,
  normalizeRedirectUri,
  validateAllowedClient,
} from './allowed-clients';

describe('validateAllowedClient (env-first)', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearAllowedClientsCache();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    delete process.env.ALLOWED_CLIENTS;
    delete process.env.MYSO_INDEXER_GRAPHQL_URL;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    clearAllowedClientsCache();
    delete process.env.ALLOWED_CLIENTS;
    delete process.env.MYSO_INDEXER_GRAPHQL_URL;
    vi.restoreAllMocks();
  });

  it('returns ok on env match without calling GraphQL', async () => {
    process.env.ALLOWED_CLIENTS = JSON.stringify([
      {
        client_id: 'my-client',
        redirect_uri: 'https://app.example.com/auth/callback',
      },
    ]);
    process.env.MYSO_INDEXER_GRAPHQL_URL = 'https://graphql.example.com/graphql';

    const result = await validateAllowedClient(
      'my-client',
      'https://app.example.com/auth/callback/'
    );

    expect(result).toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls GraphQL when env has no matching client_id', async () => {
    process.env.ALLOWED_CLIENTS = JSON.stringify([
      {
        client_id: 'other-client',
        redirect_uri: 'https://other.example.com/callback',
      },
    ]);
    process.env.MYSO_INDEXER_GRAPHQL_URL = 'https://graphql.example.com/graphql';

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          platforms: [
            {
              platformId: 'gql-client',
              statusText: 'Active',
              redirectUri: 'https://app.example.com/auth/callback',
              links: null,
            },
          ],
        },
      }),
    });

    const result = await validateAllowedClient(
      'gql-client',
      'https://app.example.com/auth/callback'
    );

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls through to GraphQL when env client_id matches but redirect_uri does not', async () => {
    process.env.ALLOWED_CLIENTS = JSON.stringify([
      {
        client_id: 'my-client',
        redirect_uri: 'https://wrong.example.com/callback',
      },
    ]);
    process.env.MYSO_INDEXER_GRAPHQL_URL = 'https://graphql.example.com/graphql';

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          platforms: [
            {
              platformId: 'my-client',
              statusText: 'Active',
              redirectUri: 'https://app.example.com/auth/callback',
              links: null,
            },
          ],
        },
      }),
    });

    const result = await validateAllowedClient(
      'my-client',
      'https://app.example.com/auth/callback'
    );

    // Env short-circuit misses; merge still prefers env redirect for that client_id
    expect(result).toEqual({ ok: false, reason: 'redirect_uri_mismatch' });
    expect(fetchMock).toHaveBeenCalled();
  });

  it('allows GraphQL match when env has no entry for that client_id', async () => {
    process.env.ALLOWED_CLIENTS = JSON.stringify([
      {
        client_id: 'unrelated',
        redirect_uri: 'https://unrelated.example.com/callback',
      },
    ]);
    process.env.MYSO_INDEXER_GRAPHQL_URL = 'https://graphql.example.com/graphql';

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          platforms: [
            {
              platformId: 'gql-only',
              statusText: 'Active',
              redirectUri: 'https://app.example.com/auth/callback',
              links: null,
            },
          ],
        },
      }),
    });

    const result = await validateAllowedClient(
      'gql-only',
      'https://app.example.com/auth/callback'
    );

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalled();
  });

  it('returns unknown_client when neither env nor GraphQL match', async () => {
    process.env.MYSO_INDEXER_GRAPHQL_URL = 'https://graphql.example.com/graphql';
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { platforms: [] } }),
    });

    const result = await validateAllowedClient(
      'missing',
      'https://app.example.com/callback'
    );

    expect(result).toEqual({ ok: false, reason: 'unknown_client' });
  });

  it('normalizes trailing slash for env short-circuit', () => {
    expect(normalizeRedirectUri('https://a.example.com/cb/')).toBe(
      'https://a.example.com/cb'
    );
  });
});
