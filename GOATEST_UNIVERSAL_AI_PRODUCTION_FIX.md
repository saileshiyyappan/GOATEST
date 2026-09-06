# GOATEST UNIVERSAL AI — PRODUCTION FIX

## 1. ROOT CAUSE

- exact failure: the Android production build has an empty `VITE_API_BASE_URL`.
- where request stopped: before `fetch()`; native `apiUrl('/api/ai/chat')` throws `API_BASE_URL_NOT_CONFIGURED`.
- evidence: `home/.env` and `home/.env.local` are absent; `.env.example` leaves `VITE_API_BASE_URL=""`; no production backend URL exists anywhere in the project configuration.

The local server route was also tested directly. Without a Bearer token it returned HTTP 401, proving the canonical route and authentication boundary are active. An authenticated OpenRouter response could not be produced because the workspace has no Firebase Admin credentials and no `OPENROUTER_API_KEY`.

## 2. BACKEND

- production backend URL: NOT CONFIGURED / NOT FOUND IN REPOSITORY
- `/api/ai/chat` reachable: local development route reachable; production HTTPS endpoint unavailable
- authentication: enforced; unauthenticated direct request returned HTTP 401
- OpenRouter: server implementation uses `https://openrouter.ai/api/v1/chat/completions`; `OPENROUTER_API_KEY` is unset
- model: default source configuration is `google/gemini-2.5-flash`; runtime availability not verifiable without the provider key
- real response: NOT AVAILABLE because deployment configuration is missing

## 3. ANDROID

- `VITE_API_BASE_URL`: empty
- HTTPS: no production URL is embedded in the APK
- Android request: stops locally with `API_BASE_URL_NOT_CONFIGURED`
- HTTP result: no production request is sent

Android INTERNET permission is present. The failure is configuration, not cleartext policy, CORS, DNS, TLS, or Firebase authentication.

## 4. FIX

Files changed:

- `home/src/services/aiConfigService.ts`
- `home/src/services/aiService.ts`
- `home/server.ts`

Exact changes:

- added safe endpoint/method/status/elapsed-time diagnostics;
- classified backend-not-configured, network, authentication, timeout, provider, rate-limit, model, and invalid-response failures;
- preserved the canonical authenticated `POST /api/ai/chat` path;
- added server-side AI request/provider diagnostics without logging keys, tokens, prompts, or responses;
- preserved retry behavior as a new request;
- preserved server-only OpenRouter secret handling.

## 5. RUNTIME PROOF

- Daily Q/A real response: FAIL — no production URL/credentials
- Retry: PASS as a new request path; real response unavailable
- New Q/A session: FAIL — same deployment blocker
- Caretaker AI: NOT VERIFIED
- Report AI: NOT VERIFIED; existing AI caller remains on the canonical service

## 6. SECURITY

- OpenRouter key exposed in frontend: NO
- OpenRouter key exposed in APK: NO
- user API key required: NO
- frontend/APK secret scan: PASS

## 7. FINAL VERDICT

FAIL — the code path is centralized and diagnostically fixed, but production AI is not operational because the required deployment configuration does not exist in this workspace.

Required external completion:

1. Deploy `home/server.ts`/`dist/server.cjs` over HTTPS.
2. Set the deployed HTTPS origin as `VITE_API_BASE_URL` before the Android build.
3. Set server-side `OPENROUTER_API_KEY`.
4. Set Firebase Admin credentials for Bearer-token verification.
5. Rebuild the APK and verify a real authenticated response from `/api/ai/chat`.

Do not put any of these secrets into React, Vite variables, the APK, localStorage, or the repository.
