<img src="assets/icon.svg" width="48" height="48" alt="">

# Quiz

Private multiplayer trivia and preset solo play, with anonymous guest sessions and server-controlled timing. React/Vite, a modular Go backend, PostgreSQL authority, and disposable Redis coordination/cache.

The app supports preset and custom quizzes with a **10-second timer** per question. Product requirements are in [SPEC.md](SPEC.md).

## Run locally

Teacher and student accounts are available through **Create an account** on the homepage. Only signed-in teachers can create and host multiplayer quizzes; students and guests can join, and solo play remains open. See [account authentication](docs/auth.md) for the API contract, session handling, and public-deployment prerequisites. For load testing, supply an existing teacher's `QUIZ_TEACHER_EMAIL` and `QUIZ_TEACHER_PASSWORD` as environment variables.

Prerequisites: Docker Compose v2 and OpenSSL. Development outside containers also needs Go 1.27.3, Node 26.8.2 (or a compatible current Node), and npm.

```sh
make up
```

Open **https://localhost:8443** for Docker Compose. This creates a local self-signed certificate; accept its localhost browser exception or replace it with a locally trusted certificate. For local development without certificate warnings, use **http://localhost:8443** with `make dev`, or **http://localhost:5173** with Vite as described below. HTTPS keeps Secure, HttpOnly guest cookies; explicit local HTTP mode uses a separate HttpOnly development cookie and refuses non-loopback bind addresses.

`make up` builds the UI/backend, starts PostgreSQL 18.6 and Redis 8.10.3, and applies versioned SQL migrations automatically. PostgreSQL data lives in the `postgres-data` Compose volume. `make down` stops containers and preserves that volume. No external API, account, or paid service is needed. The published ports bind only to loopback. The Compose app runs as root solely to read the owner-only, bind-mounted development TLS key; the image's default user is unprivileged.

## Develop with hot reload

```sh
make infra
npm --prefix web ci
make dev
```

In a second terminal:

```sh
npm --prefix web run dev
```

Use **http://localhost:5173**. Vite proxies HTTP and WebSocket API traffic to Go on port 8443. No certificate is needed. To run the built UI directly at **http://localhost:8443**:

```sh
npm --prefix web run build
make dev
```

`make dev` sets `LOCAL_HTTP=true` and binds to `127.0.0.1:8443`. Running `go run ./cmd/server` without that flag keeps HTTPS; generate certificates first with `make certs`. Switching protocols starts a separate guest identity, so rejoin a room if necessary.

Migrations in `migrations/` run at backend startup, under an advisory lock and a transaction. Do not modify an already-applied migration; add another numbered file. Development trivia is embedded, so no seed command is needed. Review the seed questions for accuracy and ambiguity before public use.

### Use a Tailscale IP over HTTP

Start the backend with the tailnet address in its allowed origins:

```sh
TAILSCALE_IP="$(tailscale ip -4)"
APP_ORIGIN="http://localhost:8443,http://localhost:5173,http://127.0.0.1:8443,http://127.0.0.1:5173,http://${TAILSCALE_IP}:5174" make dev
```

In another terminal, bind Vite directly to the Tailscale interface, without a Tailscale Serve web handler:

```sh
cd web
npm exec -- vite --host "$(tailscale ip -4)" --port 5174
```

Open `http://<your-tailscale-ip>:5174` on a device connected to your tailnet. Vite handles HTTP and WebSockets directly on that interface; Go, PostgreSQL, and Redis remain on loopback. This does not publish the site to the public internet or bind Vite to your LAN interface. The built app is still available locally at `http://localhost:8443`. If you previously configured the port 5173 forward, remove only that forward with `tailscale serve --tcp=5173 off`; do not reset unrelated Tailscale Serve services.

For a phone on your LAN, supply a certificate trusted by that device with the appropriate hostname/IP SAN, bind Go to the LAN interface, and set `APP_ORIGIN` to the exact HTTPS address used by the phone. This setup has not been validated on a physical phone. Mobile Chromium viewport checks have been run. Never reuse the sample database credentials for an exposed deployment.

## Verify

```sh
make test
make integration
make e2e
make load
```

`make test` runs Go tests with the race detector plus TypeScript checks. Database integration tests skip unless `TEST_DATABASE_URL` is set; `make integration` supplies the local Compose defaults and creates/drops isolated test schemas. It never clears an existing application's schema. PostgreSQL must be reachable; Redis-loss behavior is covered independently.

Browser tests require the running built app (`make dev` for HTTP) and Playwright Chromium. Set `APP_URL=https://localhost:8443` to test an HTTPS server instead:

```sh
npm --prefix web exec playwright install chromium
npm --prefix web run test:e2e
```

These tests use isolated browser profiles. Failures retain traces under `.local/playwright-results`. To test another local address, set `APP_URL`.

Load testing creates a real room and 150 secure-cookie guests, opens their WebSockets, answers five questions per player, retries every answer, verifies committed receipts against every final score, and waits for all final leaderboards:

```sh
go run ./cmd/loadtest -players 150 -output .local/load-150.json
```

The local load client accepts the self-signed application certificate only for localhost/127.0.0.1. For a trusted certificate, pass `-insecure-local=false`. Set `-url` and `-timeout` as needed. The report includes acknowledgement latency percentiles. This is a single-room synthetic load test, not a production capacity guarantee.

## Configuration

All variables configure the Go server; defaults support the native development workflow.

| Variable            | Default                                                                | Purpose                                                               |
| ------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `DATABASE_URL`      | `postgres://quiz:local-quiz-only@localhost:55432/quiz?sslmode=disable` | Local development PostgreSQL; durable authority                       |
| `REDIS_URL`         | `redis://localhost:56379/0`                                            | Disposable presence, internal views, pub/sub                          |
| `APP_ORIGIN`        | localhost and 127.0.0.1 on ports 8443 and 5173; HTTPS unless `LOCAL_HTTP=true` | Exact allowed browser origins, comma separated                        |
| `LISTEN_ADDR`       | `127.0.0.1:8443`                                                       | Bind address; Compose overrides to `:8443` inside its container |
| `LOCAL_HTTP`        | unset (`make dev` sets `true`)                                        | Enable plain HTTP with a separate development cookie; numeric loopback bind only |
| `TLS_CERT`          | `.local/certs/localhost.pem`                                           | HTTPS certificate                                                     |
| `TLS_KEY`           | `.local/certs/localhost-key.pem`                                       | HTTPS private key                                                     |
| `STATIC_DIR`        | `web/dist`                                                             | Compiled React app                                                    |
| `MIGRATIONS_DIR`    | `migrations`                                                           | SQL migrations                                                        |
| `TEST_DATABASE_URL` | unset                                                                  | Enables isolated PostgreSQL integration tests                         |
| `TEST_REDIS_URL`    | `redis://localhost:56379/0`                                            | Integration-test Redis                                                |

The displayed sample password is a local development credential. Real credentials belong in environment/secret files outside version control. `.env` is ignored, but Go does not automatically load it; export variables in your shell or provide them through Compose.

## Work with the code

- `internal/content`, `rooms`, `gameplay`, `scoring`, `sessions`: core rules and identities.
- `internal/storage`: migrations, row-locked transactions, answer uniqueness, cache.
- `internal/transport`: HTTP/WebSocket protocol, permissions, recovery worker.
- `web/src/components`: home, setup/editor, join, room/game/results views.
- `cmd/loadtest`: reproducible single-room protocol load harness.

No correct answers are exposed before an individual submission/timeout. Accepted answers and aggregate progress commit together. Reconnects keep deadlines; opening a new tab transfers control away from the old one. Redis loss cannot erase earned points.

Custom quizzes save only when you choose **Save a copy**. Open/Delete operate in that browser, with no account sync. Replay preserves identities; players opt into the next round and newcomers can join its lobby. Results stay visible until the host creates the next lobby, whose fixed 10-minute start deadline begins then. Competition ranks use 1, 1, 3 as a reversible engineering default.

Room history is currently a row-locked JSONB aggregate plus a relational accepted-answer ledger. It is deliberately simple and measured locally, but large custom quizzes, long histories, multiple simultaneous rooms, and deployment topology require additional validation. Automated durable data deletion, session rotation/revocation controls, final content review, additional timer choices, formal accessibility targets, and real-device/cross-browser certification remain open. There is no login or public deployment.
