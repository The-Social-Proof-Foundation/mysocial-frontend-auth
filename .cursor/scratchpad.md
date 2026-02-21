# auth.mysocial.network Frontend - Scratchpad

## Background and Motivation

Build a TypeScript/Next.js frontend for auth.mysocial.network, the MySocial Auth login server. Consuming apps open it with provider and flow params; the app immediately redirects to the chosen OAuth provider (Google, Apple, Facebook, Twitch) and on callback exchanges the provider code for a MySocial auth code via the backend.

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

## Lessons

- Zod 4 uses `error.issues` instead of `error.errors`
- useSearchParams() requires Suspense boundary in Next.js 14
- iron-session with Next.js App Router uses `getIronSession(cookies(), options)` - cookies() from next/headers
