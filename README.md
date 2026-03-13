# auth.testnet.mysocial.network

MySocial Auth login server. Handles OAuth with Google, Apple, Facebook, and Twitch. When accessed directly (with env config), shows a login/wallet UI. Consuming apps can open this app with a `provider` query parameter for immediate redirect to the chosen provider, or with `provider=none`/`provider=default` to show the login picker so the user can choose a method.

## Setup

### Prerequisites

- Node.js 20.x
- pnpm

### Install

```bash
pnpm install
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_STATE_SECRET` | Yes | 32+ character secret for cookie encryption. Generate with `openssl rand -base64 32` |
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Salt service URL (e.g. `https://salt.testnet.mysocial.network`) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Yes* | Google OAuth client ID |
| `NEXT_PUBLIC_APPLE_CLIENT_ID` | Yes* | Apple Sign In client ID |
| `NEXT_PUBLIC_FACEBOOK_APP_ID` | Yes* | Facebook app ID |
| `NEXT_PUBLIC_TWITCH_CLIENT_ID` | Yes* | Twitch client ID |
| `NEXT_PUBLIC_AUTH_CALLBACK_URL` | No | Override callback URL (default: `https://auth.testnet.mysocial.network/callback`) |
| `NEXT_PUBLIC_AUTH_CALLBACK_PATH` | No | Override backend path (default: `/auth/provider/callback`). Use if backend uses e.g. `/api/auth/provider/callback` |
| `NEXT_PUBLIC_AUTH_WALLET_CALLBACK_PATH` | No | Override backend wallet auth path (default: `/auth/wallet/callback`) |
| `NEXT_PUBLIC_DEV_CLIENT_ID` | No* | Platform client ID for direct access; must match backend allowlist |
| `NEXT_PUBLIC_DEV_CODE_CHALLENGE` | No* | PKCE S256 code challenge for direct access |
| `NEXT_PUBLIC_DEV_REDIRECT_URI` | No | Override redirect URI for direct access (default: `{origin}/callback`) |
| `NEXT_PUBLIC_APP_REDIRECT_URI` | No* | Where to redirect after Create/Import wallet (e.g. main app URL) |

\* At least one provider must be configured. Configure only the providers you use.
\** For direct access (login/wallet UI on homepage): set `NEXT_PUBLIC_DEV_CLIENT_ID` and `NEXT_PUBLIC_DEV_CODE_CHALLENGE`. For wallet flows: set `NEXT_PUBLIC_APP_REDIRECT_URI`.

### Provider Setup

Each provider requires:

1. **Redirect URI**: Register `https://auth.testnet.mysocial.network/callback` (or your `NEXT_PUBLIC_AUTH_CALLBACK_URL`) in the provider's developer console.
2. **Client ID**: Add the client ID to your `.env.local`.

### Run Locally

```bash
pnpm dev
```

For local testing, set `NEXT_PUBLIC_AUTH_CALLBACK_URL=http://localhost:3000/callback` and register that URL with each provider (if they allow localhost).

### Direct Access / Local Development

When users land on the auth frontend without URL params (e.g. typing the URL directly), the login/wallet UI appears only if `NEXT_PUBLIC_DEV_CLIENT_ID` and `NEXT_PUBLIC_DEV_CODE_CHALLENGE` are set.

**PKCE code challenge**: Generate with:
```bash
echo -n "your-43-char-minimum-verifier-string!!" | openssl dgst -binary -sha256 | base64 | tr '+/' '-_' | tr -d '='
```

The `client_id` must match your backend allowlist (e.g. `ALLOWED_CLIENTS`).

## URL Contract

Entry point:

```
https://auth.testnet.mysocial.network/login?<params>
```

**Required query parameters:**

| Param | Description |
|-------|-------------|
| `client_id` | Platform ID (allowlisted on backend) |
| `redirect_uri` | Callback URL (e.g. `https://mysocial.network/auth/callback`) |
| `state` | CSRF token |
| `nonce` | Replay protection |
| `return_origin` | Origin of opener (for postMessage validation) |
| `mode` | `popup` or `redirect` |
| `provider` | `google` \| `apple` \| `facebook` \| `twitch` \| `none` \| `default` |
| `code_challenge` | PKCE code challenge (S256) |
| `code_challenge_method` | `S256` |
| `request_id` | (Optional) From `/auth/request` |

When `provider` is `none` or `default`, the user is redirected to the home page to choose a login method (social or wallet). All other params must still be provided; they are stored and used when the user picks a provider.

## Flow

1. Consuming app opens `auth.testnet.mysocial.network/login?provider=google&...` (popup or redirect). Use `provider=none` or `provider=default` to show the login picker instead of redirecting immediately.
2. auth.testnet.mysocial.network reads `provider`. If `none` or `default`, redirects to the home page (login picker). Otherwise, immediately redirects to that provider's OAuth flow.
3. Provider redirects back to `/callback`.
4. auth.testnet.mysocial.network exchanges the provider code for a MySocial auth code (via backend `POST /auth/provider/callback`).
5. On success:
   - **popup**: `postMessage` to opener with `{ type: 'MYSOCIAL_AUTH_RESULT', code, salt?, id_token?, access_token?, session_access_token?, refresh_token?, expires_in?, user?, state, nonce, clientId, requestId?, mnemonic?, privateKey?, wallet_source? }`. Session tokens (`session_access_token`, `refresh_token`, `expires_in`) are consumed by **mysocial-auth** (myso-ts-sdk). `user` includes `{ address?, sub?, email?, ... }` when backend returns them. For wallet create/import flows, `mnemonic` or `privateKey` and `wallet_source` are included so the app can derive the keypair locally.
   - **redirect**: redirect to `redirect_uri` with `?code=...&salt=...&address=...&sub=...&state=...&nonce=...` in query params. Tokens are passed in the **hash fragment** (`#access_token=...&id_token=...&session_access_token=...&refresh_token=...&expires_in=...`) so they stay client-side.
6. On error:
   - **popup**: `postMessage` with `{ type: 'MYSOCIAL_AUTH_ERROR', error, state, nonce?, clientId?, requestId? }`.
   - **redirect**: redirect to `redirect_uri` with `?error=...&state=...`.

## Safari Popup Fallback

Safari (and iOS WebKit) clears `window.opener` after OAuth redirects in popups, so the callback cannot use `postMessage` to the opener. When `mode=popup` and `window.opener` is null, the auth frontend redirects to `redirect_uri` with all auth params plus `_popup_fallback=1`. The popup then loads the consuming app's redirect_uri page (same-origin as the opener).

**Consuming app requirement:** The redirect_uri page must handle `_popup_fallback=1`:

1. On load, check for `_popup_fallback=1` in the URL and auth params (code, state, hash fragment).
2. If present: parse the full payload from query params and hash fragment, broadcast via `BroadcastChannel` (name: `mysocial-auth`), then call `window.close()`.
3. The main window must listen for `BroadcastChannel` in addition to `postMessage` and process `MYSOCIAL_AUTH_RESULT` the same way.

**Redirect URL params** (query): `code`, `salt?`, `address?`, `sub?`, `state`, `nonce`, `clientId`, `requestId?`, `email?`, `_popup_fallback=1`. **Hash fragment**: `access_token?`, `id_token?`, `session_access_token?`, `refresh_token?`, `expires_in?`. Build `user` as `{ address?, sub?, email? }` from `address`, `sub`, `email` query params.

Payload shape: `{ type: 'MYSOCIAL_AUTH_RESULT', code, salt?, id_token?, access_token?, session_access_token?, refresh_token?, expires_in?, user?, state, nonce, clientId, requestId? }`.

## Wallet Auth Flow

When the user chooses **Create Wallet** or **Import Wallet** from the login picker (`provider=none`):

1. Auth params (client_id, redirect_uri, state, nonce, mode, return_origin) are stored in session.
2. User creates or imports a wallet on `/create-wallet` or `/import-wallet`.
3. On the final button click, the frontend:
   - Generates a challenge message: `Login to MySocial\n{timestamp}\n{state}`
   - Signs it with the wallet's Ed25519 keypair (base64 SimpleSignature format)
   - POSTs to `/api/auth/wallet-callback` with `{ address, message, signature, state }`
4. The auth frontend calls the backend `POST /auth/wallet/callback` to verify the signature and exchange for session tokens.
5. On success: same as OAuth — `postMessage` `MYSOCIAL_AUTH_RESULT` (popup) or redirect with hash fragment. For wallet flows, the popup message also includes `mnemonic?`, `privateKey?`, and `wallet_source` so the consuming app can derive the keypair locally for signing. **Security:** mnemonic/privateKey are only sent via postMessage to the validated returnOrigin; never in redirect URLs (avoids leaking to history/logs).
6. Direct navigation to `/create-wallet` or `/import-wallet` without auth params shows "Please sign in from the app first."

**Backend requirement:** The backend must implement `POST /auth/wallet/callback` (see Backend API below). If not implemented, the wallet flow falls back to `MYSOCIAL_WALLET_RESULT` (no session tokens) when the backend returns an error.

## Session Token Flow

When the backend (myso-salt-service) returns session tokens (`session_access_token`, `refresh_token`, `expires_in`), consumers (e.g. **mysocial-auth** in myso-ts-sdk) must:

- **Store** `session_access_token` (30 min) in memory or short-lived store; `refresh_token` (30 days) securely.
- **Refresh** before expiry: call `POST /auth/refresh` with `{ refresh_token }` when the access token is expired or within 1–2 min of expiry. Replace stored tokens with the new ones (rotation).
- **Logout**: call `POST /auth/logout` with `{ refresh_token }`, then clear all stored tokens.
- **API calls**: send `Authorization: Bearer <session_access_token>` for `/salt` and other protected endpoints.

This auth frontend provides `lib/session-api.ts` (`refreshSession`, `logoutSession`, `getAuthHeaders`) and `lib/session-client.ts` (`SessionClient` with `refreshIfNeeded`, `logout`) for consumer use. On 401 from `/auth/refresh`, treat as session revoked and redirect to login. On 429, retry with backoff (backend limits ~10/min per IP).

## Backend API

The backend must provide:

```
POST /auth/provider/callback
Body: {
  provider: 'google' | 'apple' | 'facebook' | 'twitch',
  code: string,
  code_challenge: string,
  redirect_uri: string,
  client_id: string,
  state: string,
  nonce: string,
  request_id?: string
}
Response: { code: string, salt?: string, id_token?: string, access_token?: string, session_access_token?: string, refresh_token?: string, expires_in?: number, user?: { address?: string, sub?: string, email?: string, ... } }
```

The backend validates `client_id`, `redirect_uri`, exchanges the provider code for tokens, creates a MySocial session, and returns an auth code bound to `code_challenge`. When `JWT_SIGNING_KEY` is configured, it also returns `session_access_token` (JWT, 30 min), `refresh_token` (opaque, 30 days), and `expires_in` (seconds). The auth frontend forwards these in `MYSOCIAL_AUTH_RESULT` and redirect hash.

**Wallet auth endpoint:**

```
POST /auth/wallet/callback
Body: {
  address: string,
  message: string,
  signature: string,  // base64-encoded Ed25519 SimpleSignature (97 bytes: 0x00 + 64-byte sig + 32-byte pubkey)
  client_id: string,
  redirect_uri: string,
  state: string,
  nonce: string,
  request_id?: string
}
Response: Same as /auth/provider/callback — { code, session_access_token?, refresh_token?, expires_in?, user?: { address, sub?, email? } }
```

The backend verifies the Ed25519 signature over `message` for `address`, creates a MySocial session, and returns tokens. Challenge format: `Login to MySocial\n{timestamp}\n{state}`.

**Session endpoints:**

- `POST /auth/refresh` — Body: `{ refresh_token }`. Response: `{ access_token, refresh_token, expires_in }`. 401 = session revoked; 429 = rate limited.
- `POST /auth/logout` — Body: `{ refresh_token }`. Response: 204 or `{ ok: true }`.

## Salt Service

**Base URL:** `https://salt.testnet.mysocial.network` (testnet) or `https://salt.mysocial.network` (production)

This auth frontend calls `POST ${NEXT_PUBLIC_API_BASE_URL}/auth/provider/callback` to exchange the OAuth code. The salt service implements that endpoint, exchanges the code for tokens, fetches the salt, and returns `{ code, salt }`.

**Option 1 – Call `POST /salt` when you have a session token (preferred):**

```js
const res = await fetch(`${SALT_SERVICE_URL}/salt`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${sessionAccessToken}`,
  },
});
const { salt } = await res.json(); // BigInt decimal string, ready for zkLogin
```

Refresh `session_access_token` via `POST /auth/refresh` before expiry (30 min).

**Option 2 – Call `POST /salt` with provider tokens (legacy):**

Google/Apple (JWT):

```js
const res = await fetch(`${SALT_SERVICE_URL}/salt`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ jwt: idToken }),
});
const { salt } = await res.json();
```

Facebook/Twitch (access token):

```js
const res = await fetch(`${SALT_SERVICE_URL}/salt`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ provider: 'facebook', token: accessToken }),
});
const { salt } = await res.json();
```

**Option 3 – Call `POST /auth/provider/callback` when you have an OAuth code** (used by this auth frontend):

```js
const res = await fetch(`${SALT_SERVICE_URL}/auth/provider/callback`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    code: authCode,
    state: stateParam,
    nonce: nonceParam,
    code_verifier: codeVerifier, // if using PKCE
  }),
});
const { user, salt, access_token } = await res.json();
```

**Readiness check:** `GET ${SALT_SERVICE_URL}/salt/check` returns `{ status: "ready" }`.

**CORS:** `ALLOWED_ORIGINS` must include your frontend origin (e.g. `https://auth.testnet.mysocial.network`).

## Deployment (Railway)

1. Create a new project on [Railway](https://railway.app).
2. Connect your Git repository.
3. Add environment variables (see above).
4. Set the root directory to this project.
5. `railway.json` defines build and deploy config (config-as-code). Railway will use it automatically.

### Build Command

```bash
pnpm run build
```

### Start Command

```bash
pnpm start
```

### Custom Domain

Configure your domain (e.g. `auth.testnet.mysocial.network`) in Railway's project settings. Ensure the callback URL matches what's registered with each OAuth provider.

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Homepage; shows login/wallet UI when direct access env vars are set or when arriving via `provider=none` |
| `/login` | Entry point; validates params, stores state, redirects to provider OAuth |
| `/callback` | Receives provider callback; exchanges code; postMessage or redirect |
| `/create-wallet` | Create new wallet; sign challenge, exchange for session tokens, postMessage MYSOCIAL_AUTH_RESULT |
| `/import-wallet` | Import wallet from mnemonic or private key; sign challenge, exchange for session tokens, postMessage MYSOCIAL_AUTH_RESULT |
| `/error` | Invalid params or failed auth |
