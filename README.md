# auth.mysocial.network

MySocial Auth login server. Handles OAuth with Google, Apple, Facebook, and Twitch. When accessed directly (with env config), shows a login/wallet UI. Consuming apps can also open this app with a `provider` query parameter for immediate redirect to the chosen provider.

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
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Backend API URL (e.g. `https://api.mysocial.network`) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Yes* | Google OAuth client ID |
| `NEXT_PUBLIC_APPLE_CLIENT_ID` | Yes* | Apple Sign In client ID |
| `NEXT_PUBLIC_FACEBOOK_APP_ID` | Yes* | Facebook app ID |
| `NEXT_PUBLIC_TWITCH_CLIENT_ID` | Yes* | Twitch client ID |
| `NEXT_PUBLIC_AUTH_CALLBACK_URL` | No | Override callback URL (default: `https://auth.mysocial.network/callback`) |
| `NEXT_PUBLIC_DEV_CLIENT_ID` | No* | Platform client ID for direct access; must match backend allowlist |
| `NEXT_PUBLIC_DEV_CODE_CHALLENGE` | No* | PKCE S256 code challenge for direct access |
| `NEXT_PUBLIC_DEV_REDIRECT_URI` | No | Override redirect URI for direct access (default: `{origin}/callback`) |
| `NEXT_PUBLIC_APP_REDIRECT_URI` | No* | Where to redirect after Create/Import wallet (e.g. main app URL) |

\* At least one provider must be configured. Configure only the providers you use.
\** For direct access (login/wallet UI on homepage): set `NEXT_PUBLIC_DEV_CLIENT_ID` and `NEXT_PUBLIC_DEV_CODE_CHALLENGE`. For wallet flows: set `NEXT_PUBLIC_APP_REDIRECT_URI`.

### Provider Setup

Each provider requires:

1. **Redirect URI**: Register `https://auth.mysocial.network/callback` (or your `NEXT_PUBLIC_AUTH_CALLBACK_URL`) in the provider's developer console.
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
https://auth.mysocial.network/login?<params>
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
| `provider` | `google` \| `apple` \| `facebook` \| `twitch` |
| `code_challenge` | PKCE code challenge (S256) |
| `code_challenge_method` | `S256` |
| `request_id` | (Optional) From `/auth/request` |

## Flow

1. Consuming app opens `auth.mysocial.network/login?provider=google&...` (popup or redirect).
2. auth.mysocial.network reads `provider` and immediately redirects to that provider's OAuth flow.
3. Provider redirects back to `/callback`.
4. auth.mysocial.network exchanges the provider code for a MySocial auth code (via backend `POST /auth/provider/callback`).
5. On success:
   - **popup**: `postMessage` to opener with `{ type: 'MYSOCIAL_AUTH_RESULT', code, state, nonce, clientId, requestId? }`.
   - **redirect**: redirect to `redirect_uri` with `?code=...&state=...&nonce=...`.
6. On error:
   - **popup**: `postMessage` with `{ type: 'MYSOCIAL_AUTH_ERROR', error, state, nonce?, clientId?, requestId? }`.
   - **redirect**: redirect to `redirect_uri` with `?error=...&state=...`.

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
Response: { code: string }
```

The backend validates `client_id`, `redirect_uri`, exchanges the provider code for tokens, creates a MySocial session, and returns an auth code bound to `code_challenge`.

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

Configure your domain (e.g. `auth.mysocial.network`) in Railway's project settings. Ensure the callback URL matches what's registered with each OAuth provider.

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Homepage; shows login/wallet UI when direct access env vars are set |
| `/login` | Entry point; validates params, stores state, redirects to provider OAuth |
| `/callback` | Receives provider callback; exchanges code; postMessage or redirect |
| `/create-wallet` | Create new wallet; generate mnemonic, store, redirect to app |
| `/import-wallet` | Import wallet from mnemonic or private key; store, redirect to app |
| `/error` | Invalid params or failed auth |
