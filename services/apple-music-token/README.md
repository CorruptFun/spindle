# Apple Music token service

Built in Milestone 7. Nothing here yet except the contract.

## Why it exists

Apple's web player needs a _developer token_: a short-lived token signed with a private key
from the Apple Developer account. A private key cannot ship inside a web app, so a small
server-side function signs tokens on request. Planned as a Cloudflare Worker.

## Contract

```
GET /token
→ 200 { "token": "<signed developer token>", "expiresAt": "<ISO 8601 time>" }
```

- Tokens are short-lived (hours, not months) and cached by the app until shortly before expiry.
- Only the app's own origins may call it (CORS allow-list). Everything else gets `403`.
- Rate-limited per client.

## Secrets

Three values, stored as Worker secrets and never committed: the Apple team ID, the MusicKit key
ID, and the private key. `.gitignore` already blocks `*.p8` and `.dev.vars`.

The app reads the service's address from `VITE_APPLE_MUSIC_TOKEN_URL` (see `.env.example`).
