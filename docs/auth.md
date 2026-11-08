# Accounts and roles

Accounts use email/password authentication. Roles are self-selected at signup; teacher status is not institution-verified. Existing guests can join rooms and use solo play. Creating or hosting multiplayer quizzes requires an authenticated teacher. Students cannot create rooms, even by calling the API directly. Role changes, email verification, password recovery, and institutional invitations are not part of this initial implementation.

## Contract

All mutation endpoints require an allowed `Origin` header and JSON. Responses and private account data are not cached. Passwords and session tokens are never returned as JSON.

| Endpoint | Request | Success |
| --- | --- | --- |
| `POST /api/auth/signup` | `{name,email,password,role}` where role is `teacher` or `student` | `201 {user:{id,name,email,role}}` and an account cookie |
| `POST /api/auth/login` | `{email,password}` | `200 {user}` and a fresh account cookie |
| `GET /api/auth/me` | Account cookie, if present | `200 {user}` or `{user:null}` |
| `POST /api/auth/logout` | `{}` | `200 {user:null}`; revokes the current session and clears its cookie |
| `POST /api/rooms` | Existing quiz setup | Teacher: existing success response; guest: `401`; student: `403` |

Validation errors return `400 {error}`; duplicate email returns `409`; incorrect credentials return generic `401`; throttling returns `429`; infrastructure failures return `503`. Names support 1–30 Unicode characters, email is normalized to lowercase, and passwords require 12+ characters with a 1024-byte maximum. Authentication bodies are capped at 8 KiB. The signup role is saved server-side; submitting a role during login cannot promote an account.

## Session and password handling

Passwords use PBKDF2-HMAC-SHA256 with 600,000 iterations, 16-byte random salts, and constant-time comparison. Account cookies contain random 256-bit opaque tokens; PostgreSQL stores only their SHA-256 hashes. Account sessions expire after seven days. The secure cookie is `__Host-quiz_account`, with `HttpOnly`, `Secure`, `SameSite=Lax`, and `Path=/`. Explicit loopback-only `LOCAL_HTTP=true` uses `quiz_account_local`, without `Secure`, matching the existing guest-development mode. Tailscale Serve provides HTTPS outside that local proxy boundary; public deployment must use secure-cookie mode.

Each account owns a stable gameplay identity, so signing in again restores its room membership rather than adopting another person's guest cookie. Guest identity remains separate. Logout revokes the current account token; other devices remain signed in. Account WebSockets are checked for revocation, and host commands require a current teacher session.

Authentication is rate-limited in PostgreSQL to 100 requests per peer IP and 10 per normalized email within 15 minutes, with at most four concurrent password operations per server. Forwarded IP headers are not trusted. Behind Vite/Tailscale all peers may share the local proxy budget; configure a trusted-proxy-aware edge rate limiter before a public deployment. Operational maintenance should prune expired account sessions and throttle rows.

Before public use, add verified email delivery, password recovery, account lifecycle controls, abuse monitoring, and any consent requirements for your student population. Do not treat a self-selected teacher role as proof of employment.
