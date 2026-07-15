# auth.testnet.mysocial.network Frontend - Scratchpad

## Background and Motivation

Build a TypeScript/Next.js frontend for auth.testnet.mysocial.network, the MySocial Auth login server. Consuming apps open it with provider and flow params; the app immediately redirects to the chosen OAuth provider (Google, Apple, Facebook, Twitch) and on callback exchanges the provider code for a MySocial auth code via the backend.

## Key Challenges and Analysis

- **State persistence**: Login params must survive the redirect to provider and back. Used iron-session with encrypted cookies (AUTH_STATE_SECRET).
- **Callback handling**: Provider errors vs success require different flows. API returns stored state when code is missing (for error postMessage/redirect).
- **Apple OAuth**: Uses `response_mode: 'query'` for consistency with other providers (GET callback with query params).

## High-Level Task Breakdown

1. Next.js scaffold with TypeScript, Tailwind
2. lib/params.ts - Zod validation for URL params
3. lib/providers.ts - OAuth URLs for Google, Apple, Facebook, Twitch
4. lib/state.ts - iron-session cookie for auth state
5. lib/api.ts - Backend client for provider exchange
6. /login - Validate, store state, redirect to provider
7. /callback - Exchange code, postMessage or redirect
8. /error - Error page for invalid params / failed auth
9. README and .env.example

## Project Status Board

- [x] TypeScript Next.js app scaffold
- [x] /login route: param validation, state storage, provider redirect
- [x] /callback route: provider code exchange, postMessage/redirect
- [x] /error route: invalid params / failed auth
- [x] Minimal UI: loading spinner + provider config
- [x] README and .env.example
- [x] OAuth callback path: `NEXT_PUBLIC_AUTH_CALLBACK_URL` matches `/callback`; legacy routes `/auth/callback` and `/auth/google/callback` alias the same page

## Lessons

- **OAuth callback 404 (fixed)**: `NEXT_PUBLIC_AUTH_CALLBACK_URL` must be a path this app actually serves (e.g. `https://host/callback`). Values like `/auth/google/callback` 404'd because only `app/callback/page.tsx` existed; aliases added for backward compatibility.
- Google Cloud Console authorized redirect URIs must match **exactly**—after changing env to `/callback`, add that URI and remove mismatched URIs unless keeping aliases.
- **Google/Apple `redirect_uri` bug (fixed)**: `initLogin` passed `loginParams.redirect_uri` (consuming app return URL) into `buildProviderAuthUrl`, so Google saw the wrong redirect and `redirect_uri_mismatch` unless that app URL was registered. Provider authorize URLs must use this auth app’s `/callback` (`AUTH_CALLBACK_URL`); `loginParams.redirect_uri` is only for Salt and the final post-auth redirect.
- Zod 4 uses `error.issues` instead of `error.errors`
- useSearchParams() requires Suspense boundary in Next.js 14
- iron-session with Next.js App Router uses `getIronSession(cookies(), options)` - cookies() from next/headers

## Executor's Feedback (OAuth callback 404)

- `.env`: `NEXT_PUBLIC_AUTH_CALLBACK_URL` → `https://www.mysocial.network/callback` (canonical handler `app/callback/page.tsx`).
- `lib/providers.ts`: dev and testnet fallbacks now use `/callback` instead of `/auth/callback` to match filesystem.
- `app/auth/callback/page.tsx` and `app/auth/google/callback/page.tsx`: re-export the `/callback` client page for legacy redirects.
- `.env.example` + README: document that OAuth redirect URIs must match `/callback` and register that URL in provider consoles.
- **Manual:** In Google Cloud Console, add Authorized redirect URI `https://www.mysocial.network/callback` (and optionally keep `.../auth/google/callback` if old links linger—alias covers it).
- Deploy with updated production env vars (`pnpm run build` passes locally).


## Executor's Feedback (Login + Wallet UI)

- Implemented full login/wallet UI per plan: env-based config (no hard-coding), social login buttons (Google/Apple/Facebook/Twitch per configured provider), "Or continue with" divider, Create Wallet and Import Wallet flows
- lib/build-login-url.ts: builds login URL from NEXT_PUBLIC_DEV_* env vars
- lib/wallet.ts: generateNewWallet, importWalletFromMnemonic, importWalletFromPrivateKey (uses @socialproof/myso, bip39)
- components/LoginWalletModal.tsx: main card UI; shows fallback message when direct login env vars not set
- /create-wallet, /import-wallet: separate pages for wallet flows; on success: postMessage to opener + window.close() when in popup, else redirect to NEXT_PUBLIC_APP_REDIRECT_URI?address=...
- lib/wallet-complete.ts: completeWalletFlow() sends MYSOCIAL_WALLET_RESULT to opener, uses NEXT_PUBLIC_APP_REDIRECT_URI for targetOrigin
- ReturnOriginPersister: stores opener origin in sessionStorage on first load (fallback when env unset)
- Main app: WalletMessageListener listens for MYSOCIAL_WALLET_RESULT, imports wallet, redirects to /wallet; mounted outside Web3Provider so it runs before Web3Provider mounts
- Error page: improved invalid_params messaging with README hint and dev env var suggestion

## Executor's Feedback (Provider None/Default)

- Added `provider=none` and `provider=default` (alias) to URL contract. When used, auth stores params and redirects to home so user can pick login method.
- lib/params.ts: providerParamSchema accepts none/default, transforms default→none; AuthProvider remains the four OAuth providers
- app/login/actions.ts: when provider=none, setAuthState + redirect('/')
- lib/build-login-url.ts: buildLoginUrlFromParams(params, chosenProvider) for consuming-app picker flow
- lib/auth-actions.ts: getPendingAuthParams() server action returns stored params when provider=none
- LoginWalletModal: fetches pending params on mount; shows picker when directLoginEnabled OR pendingParams; uses buildLoginUrlFromParams when pending
- app/api/auth/callback/route.ts: guard against provider=none (invalid at callback)

## Executor's Feedback (PKCE Server-Side Generation)

- **Root cause**: Google/Apple require PKCE; client often did not send `code_verifier`, so salt service could not complete token exchange.
- **Fix**: Auth frontend generates `code_verifier` and `code_challenge` server-side. `code_verifier` stays in session, never in URL.
- lib/pkce.ts: `generatePkce()` using Node crypto (32-byte verifier, SHA-256 challenge, base64url).
- lib/params.ts: `code_challenge` made optional (server supplies for Google/Apple).
- app/login/actions.ts: For provider=google/apple, generate PKCE or reuse from session when coming from picker (provider=none → pick Google). For provider=none, generate and store PKCE for when user picks later.
- lib/build-login-url.ts: Removed `code_verifier` from URLs in `buildLoginUrlFromParams` and `buildLoginUrl`.
- app/api/auth/callback/route.ts: Pass `authState.code_challenge ?? ''` for type safety (Google/Apple always have it).

## Executor's Feedback (Auth Session Pass-Through for Ed25519)

- **Goal**: Pass through full session (access_token, id_token, user with sub) to SDK for Ed25519 keypair derivation; no address derivation in frontend.
- **lib/api.ts**: Added `access_token` to `ProviderCallbackResponse`; `user` type now includes `sub` and optional `address`.
- **app/api/auth/callback/route.ts**: Removed `jwtToAddress`; no address derivation. When backend returns id_token, extract `sub` and `email` from JWT; when backend returns user, use as-is and enrich with sub from JWT if missing. Pass through `access_token` and `id_token` in response.
- **app/callback/page.tsx**: Extended `CallbackSuccess` with `access_token`, `id_token`, `user.sub`. Popup: include tokens in postMessage. Redirect: tokens in **hash fragment** (`#access_token=...&id_token=...`), not query params; add `sub` to query params.
- **README.md**: Updated flow and backend API docs; documented hash fragment for redirect tokens.
- **Build**: Passes; no regressions.

## Executor's Feedback (Wallet Flow Callback + Security)

- **Problem**: Create/Import Wallet flows did not complete callback or dismiss popup; only social flow worked. Root cause: `return_origin` never persisted when user arrived via provider=none (ReturnOriginPersister skipped because referrer was same-origin after redirect).
- **Fix**: LoginWalletModal persists `return_origin` to sessionStorage when pendingParams loads; passes `return_origin` in Create/Import Wallet link URLs. getTargetOrigin() now finds it.
- **Security**: Added `isSafeOrigin()` to validate origins before use (rejects javascript:, data:, file:, etc.; allows https and http localhost). Used in getTargetOrigin() and LoginWalletModal.
- **Security**: Removed all localStorage persistence of mnemonic/privateKey from lib/wallet.ts. Auth app is a bridge only; keys passed to consuming app via postMessage, not stored on auth domain.
- **Security**: console.error in completeWalletFlow no longer logs error object (avoids any risk of leaking message payload).

## Executor's Feedback (MySocial Wallet Session Flow)

- **Goal**: Integrate session-based auth from myso-salt-service (session_access_token, refresh_token, expires_in).
- **lib/api.ts**: Added `session_access_token`, `refresh_token`, `expires_in` to `ProviderCallbackResponse`.
- **app/api/auth/callback/route.ts**: Forward session tokens in response.
- **app/callback/page.tsx**: Extended `CallbackSuccess`; include session tokens in `MYSOCIAL_AUTH_RESULT` postMessage (popup) and redirect hash.
- **lib/session-api.ts**: `refreshSession`, `logoutSession`, `getAuthHeaders`; `SessionRevokedError` (401), `SessionRateLimitedError` (429).
- **lib/session-client.ts**: `SessionClient` with `refreshIfNeeded`, `logout`; `createSessionClient` from MYSOCIAL_AUTH_RESULT payload.
- **README.md**: Session Token Flow section; MYSOCIAL_AUTH_RESULT contract; Backend API `/auth/refresh`, `/auth/logout`; preferred `Authorization: Bearer` for `/salt`.
- **Build**: Passes.

## Executor's Feedback (Wallet Auth Callback Fix)

- **Goal**: Create/Import Wallet flows authenticate like Google Auth — call callback, get session tokens, dismiss popup.
- **lib/wallet.ts**: Added `signMessage(mnemonicOrPrivateKey, message)` — Ed25519 sign, returns base64url.
- **lib/api.ts**: Added `exchangeWalletAuth()`, `WalletAuthRequest`; `NEXT_PUBLIC_AUTH_WALLET_CALLBACK_PATH` (default `/auth/wallet/callback`).
- **app/api/auth/wallet-callback/route.ts**: POST handler; validates state, calls backend wallet auth, returns same shape as OAuth callback.
- **lib/wallet-complete.ts**: Added `completeWalletAuthFlow(success)` — postMessage MYSOCIAL_AUTH_RESULT, window.close() (popup) or redirect with hash (redirect mode). Kept `completeWalletFlow` for fallback.
- **app/create-wallet/page.tsx**, **app/import-wallet/page.tsx**: Fetch `getPendingAuthParams()` on mount. On final button: build challenge `Login to MySocial\n{timestamp}\n{state}`, sign, POST `/api/auth/wallet-callback`, then `completeWalletAuthFlow`. When no pending params: show "Please sign in from the app first", disable button. Fallback to `completeWalletFlow` when pendingParams undefined (loading) or backend fails.
- **README.md**: Wallet Auth Flow section; Backend `POST /auth/wallet/callback` contract; challenge format; env var `NEXT_PUBLIC_AUTH_WALLET_CALLBACK_PATH`.
- **Backend prerequisite**: myso-salt-service must implement `POST /auth/wallet/callback` (address, message, signature, client_id, etc.) and return session tokens. Until then, wallet flow falls back to MYSOCIAL_WALLET_RESULT on backend error.
- **Build**: Passes.

## Executor's Feedback (Wallet Keypair Pass-Through)

- **Goal**: Consuming app needs mnemonic/privateKey to derive keypair locally for signing (getKeypair()).
- **lib/wallet-complete.ts**: Added `WalletAuthWalletData`; `completeWalletAuthFlow(success, walletData?)` now accepts optional walletData. When provided, includes `mnemonic`, `privateKey`, `wallet_source` in MYSOCIAL_AUTH_RESULT postMessage.
- **Security**: mnemonic/privateKey only sent via postMessage to validated returnOrigin; never in redirect URLs (avoids history/logs). No logging of wallet credentials. API route never receives mnemonic/privateKey.
- **app/create-wallet/page.tsx**: Passes `{ mnemonic, source: 'create' }` to completeWalletAuthFlow on success.
- **app/import-wallet/page.tsx**: Passes `{ mnemonic, source: 'import' }` or `{ privateKey, source: 'import' }` to completeWalletAuthFlow on success.
- **README.md**: Documented mnemonic/privateKey/wallet_source in MYSOCIAL_AUTH_RESULT contract; security note.

## Executor's Feedback (Safari Popup Auth Fix)

- **Problem**: Safari clears `window.opener` after OAuth redirects in popups; callback falls through to redirect, popup shows explore page instead of closing.
- **Fix**: When `mode=popup` and `window.opener` is null, redirect to redirect_uri with `_popup_fallback=1`. Consuming app's redirect_uri page must detect this, broadcast MYSOCIAL_AUTH_RESULT via BroadcastChannel (`mysocial-auth`), and close.
- **app/callback/page.tsx**: Added `_popup_fallback=1` to redirect URL in success path (line ~167) and error path (line ~93) when mode is popup.
- **lib/wallet-complete.ts**: Same in `completeWalletAuthFlow` for both catch-block redirect and else-branch redirect.
- **README.md**: New "Safari Popup Fallback" section documenting the contract and consuming app requirements.

## Executor's Feedback (callback POST 405)

- **Bug**: `app/callback/page.tsx` POSTed to `/callback` (page route) → Next returned **405**; exchange lives at `POST /api/auth/callback` (`app/api/auth/callback/route.ts`).
- **Fix**: Both fetch calls now use `/api/auth/callback`; `authDebugLog` tags in the route updated to `POST /api/auth/callback`.
- **Build**: Typecheck failed on `process.env.NODE_ENV === 'development'` (narrowed `NODE_ENV`). Used `String(process.env.NODE_ENV ?? '')` in `lib/providers.ts`, `lib/state.ts`, and `app/error/page.tsx` so `pnpm run build` passes.

## Executor's Feedback (salt redirect_uri mismatch)

- Salt token exchange must receive the **OAuth provider** `redirect_uri` (this auth app), not `LoginParams.redirect_uri` (consumer app return URL).
- `AuthState` includes `provider_redirect_uri` set in `initLogin`; `exchangeProviderCode` uses `provider_redirect_uri` with env fallback.
