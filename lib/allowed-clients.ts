export type AllowedClient = {
  client_id: string;
  redirect_uri: string;
};

const ACTIVE_PLATFORMS_QUERY = `query ActivePlatforms($limit: Int, $offset: Int) {
  platforms(approvedOnly: true, limit: $limit, offset: $offset) {
    platformId
    statusText
    redirectUri
    links
  }
}`;

type PlatformRow = {
  platformId?: string | null;
  statusText?: string | null;
  redirectUri?: string | null;
  links?: Record<string, unknown> | null;
};

type GraphqlEnvelope<T> = {
  data?: T;
  errors?: Array<{ message?: string | null }>;
};

type PlatformsData = {
  platforms?: PlatformRow[] | null;
};

let cachedClients: AllowedClient[] | null = null;

function parseCsvEnv(name: string, fallback: string): string[] {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback.split(',').map((s) => s.trim()).filter(Boolean);
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export function parseAllowedClientsEnv(raw: string | undefined): AllowedClient[] {
  if (!raw?.trim()) return [];
  const parsed = JSON.parse(raw) as AllowedClient[];
  if (!Array.isArray(parsed)) {
    throw new Error('ALLOWED_CLIENTS must be a JSON array');
  }
  return parsed
    .map((entry) => ({
      client_id: entry.client_id?.trim() ?? '',
      redirect_uri: entry.redirect_uri?.trim() ?? '',
    }))
    .filter((entry) => entry.client_id && entry.redirect_uri);
}

export function mergeAllowedClients(
  indexer: AllowedClient[],
  env: AllowedClient[]
): AllowedClient[] {
  const map = new Map<string, AllowedClient>();
  for (const client of indexer) {
    map.set(client.client_id, client);
  }
  for (const client of env) {
    map.set(client.client_id, client);
  }
  return Array.from(map.values()).sort((a, b) => a.client_id.localeCompare(b.client_id));
}

function platformPassesStatusFilter(
  statusText: string | null | undefined,
  allowlist: string[],
  denylist: string[]
): boolean {
  const status = statusText?.trim();
  if (!status) return false;
  if (allowlist.length > 0) {
    return allowlist.includes(status);
  }
  return !denylist.includes(status);
}

export function redirectUriFromLinks(
  links: Record<string, unknown> | null | undefined,
  keys: string[]
): string | undefined {
  if (!links || keys.length === 0) return undefined;
  for (const key of keys) {
    const trimmedKey = key.trim();
    if (!trimmedKey) continue;
    const value = links[trimmedKey];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return undefined;
}

export function resolvePlatformRedirectUri(
  redirectUri: string | null | undefined,
  links: Record<string, unknown> | null | undefined,
  keys: string[]
): string | undefined {
  const onChain = redirectUri?.trim();
  if (onChain) return onChain;
  return redirectUriFromLinks(links, keys);
}

export function normalizeRedirectUri(uri: string): string {
  const trimmed = uri.trim();
  try {
    const url = new URL(trimmed);
    url.hash = '';
    const normalized = url.toString();
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  } catch {
    return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  }
}

/** GraphQL `platforms` clamps limit to 100; keep page size within that so pagination advances. */
const INDEXER_PLATFORMS_MAX_PAGE = 100;

async function fetchAllowedClientsFromIndexer(): Promise<AllowedClient[]> {
  const url = process.env.MYSO_INDEXER_GRAPHQL_URL?.trim();
  if (!url) return [];

  const pageLimit = Number.parseInt(
    process.env.INDEXER_PLATFORMS_PAGE_LIMIT ?? String(INDEXER_PLATFORMS_MAX_PAGE),
    10
  );
  const requested = Number.isFinite(pageLimit) && pageLimit > 0 ? pageLimit : INDEXER_PLATFORMS_MAX_PAGE;
  const limit = Math.min(requested, INDEXER_PLATFORMS_MAX_PAGE);
  const allowlist = parseCsvEnv('PLATFORM_STATUS_ALLOWLIST', '');
  const denylist = parseCsvEnv('PLATFORM_STATUS_DENYLIST', 'Shutdown,Sunset');
  const linkKeys = parseCsvEnv('PLATFORM_LINKS_REDIRECT_KEYS', 'website,url,oauthRedirect');
  const requireRedirect =
    (process.env.REQUIRE_REDIRECT_URI_FROM_LINKS ?? '').trim().toLowerCase() === 'true' ||
    ['1', 'yes'].includes((process.env.REQUIRE_REDIRECT_URI_FROM_LINKS ?? '').trim().toLowerCase());

  const out: AllowedClient[] = [];
  let offset = 0;

  while (true) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: ACTIVE_PLATFORMS_QUERY,
        variables: { limit, offset },
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`indexer GraphQL HTTP ${response.status}: ${await response.text()}`);
    }

    const parsed = (await response.json()) as GraphqlEnvelope<PlatformsData>;
    const errors = parsed.errors?.map((e) => e.message).filter(Boolean) ?? [];
    if (errors.length > 0) {
      throw new Error(`indexer GraphQL errors: ${errors.join('; ')}`);
    }

    const platforms = parsed.data?.platforms ?? [];
    if (platforms.length === 0) break;

    for (const row of platforms) {
      if (!platformPassesStatusFilter(row.statusText, allowlist, denylist)) {
        continue;
      }

      const redirect = resolvePlatformRedirectUri(row.redirectUri, row.links, linkKeys);
      if (requireRedirect && !redirect) {
        continue;
      }
      if (!redirect) {
        continue;
      }

      const platformId = row.platformId?.trim();
      if (!platformId) continue;

      out.push({ client_id: platformId, redirect_uri: redirect });
    }

    if (platforms.length < limit) break;
    offset += limit;
  }

  return out;
}

export async function getMergedAllowedClients(): Promise<AllowedClient[]> {
  if (cachedClients) return cachedClients;

  const envClients = parseAllowedClientsEnv(process.env.ALLOWED_CLIENTS);
  let indexerClients: AllowedClient[] = [];

  if (process.env.MYSO_INDEXER_GRAPHQL_URL?.trim()) {
    try {
      indexerClients = await fetchAllowedClientsFromIndexer();
    } catch (error) {
      console.warn(
        'Indexer platform fetch failed; continuing with ALLOWED_CLIENTS env only',
        error
      );
    }
  }

  cachedClients = mergeAllowedClients(indexerClients, envClients);
  return cachedClients;
}

/**
 * Validate client_id + redirect_uri.
 * Env ALLOWED_CLIENTS is checked first: an exact match short-circuits without GraphQL.
 * Otherwise falls back to indexer GraphQL + env merge (env wins on duplicate client_id).
 */
export async function validateAllowedClient(
  clientId: string,
  redirectUri: string
): Promise<{ ok: true } | { ok: false; reason: 'unknown_client' | 'redirect_uri_mismatch' }> {
  const envClients = parseAllowedClientsEnv(process.env.ALLOWED_CLIENTS);
  const envMatch = envClients.find((client) => client.client_id === clientId);
  if (
    envMatch &&
    normalizeRedirectUri(envMatch.redirect_uri) === normalizeRedirectUri(redirectUri)
  ) {
    return { ok: true };
  }

  const allowed = await getMergedAllowedClients();
  const match = allowed.find((client) => client.client_id === clientId);
  if (!match) {
    return { ok: false, reason: 'unknown_client' };
  }
  if (normalizeRedirectUri(match.redirect_uri) !== normalizeRedirectUri(redirectUri)) {
    return { ok: false, reason: 'redirect_uri_mismatch' };
  }
  return { ok: true };
}

/** Clear in-memory allowlist cache (for tests). */
export function clearAllowedClientsCache(): void {
  cachedClients = null;
}
