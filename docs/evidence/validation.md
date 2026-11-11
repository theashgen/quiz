# Validation record

## Peach Playground media refresh — November 11, 2026

Captured the built application served by the local Go backend at `http://localhost:8443`, using application revision `6f5e1b8`. PostgreSQL and Redis were running locally. This branch changes only documentation, capture scripts and media; it does not change the app or backend. These are local observations, not a public-deployment certification.

| Command                               | Observed result                                                                                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm --prefix web ci`                 | Installed the existing pinned dependencies; no library changes                                                                                                                 |
| `node docs/demo/capture.cjs`          | Complete teacher signup/custom setup, 12-player round, correct/incorrect/timeout feedback, standings, replay and five-question desktop solo workflow                           |
| `node docs/demo/capture-states.cjs`   | Account permissions, tab takeover, reconnection, expiry, save failure, deliberate loading and mobile navigation/gameplay captures                                              |
| `node docs/demo/backend-evidence.cjs` | Room `JPCPKS`: 12 distinct answering sessions, 36 ledger records, 2,600 total points, one timeout; all 11 clients' receipts and every final leaderboard score match PostgreSQL |
| `python3 docs/demo/render-video.py`   | Silent H.264 MP4, 1440 × 1000, 30 fps, 84.56 seconds, three embedded workflow chapters                                                                                         |
| `node docs/demo/verify-media.cjs`     | 41 PNG dimensions/manifest entries, no broken images or document-level horizontal overflow, local documentation links, video metadata and full decode                          |

The database commands used local environment credentials, not a committed password. The expiry fixture changes only its newly created lobby; network/storage failure fixtures are isolated from the recorded multiplayer room. Loading and error screenshots are deliberately labelled; they are not shown as normal workflow states.

Visual review uses all screenshot contact sheets, full-size desktop/mobile images and video frames sampled every four seconds, plus full-size frames around the chapter transitions. Dense content uses the app's real scrollable workspaces. See the [reproduction notes](../demo/README.md) and [per-image provenance](screenshots.json).

The frontend suite was **not rerun** for this docs/media-only refresh. The UI handoff reported all 52 frontend tests passing; that is prior UI-branch validation, not a new result from this branch. No fresh Go/integration test claim is made here.

## Earlier validation — November 10, 2026

The following results are preserved from the earlier README capture, which included the then-ongoing Tailwind migration. They are historical checks, not results rerun against the Peach Playground refresh.

| Command                                                                                                                                            | Result                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `go test -race ./...`                                                                                                                              | Passed; database-dependent tests skip without a test database URL               |
| `TEST_DATABASE_URL="$DATABASE_URL" TEST_REDIS_URL=redis://localhost:56379/0 go test -race -count=1 ./...`                                          | Passed, including transport integration tests against isolated database schemas |
| `npm --prefix web run build`                                                                                                                       | Passed TypeScript compilation and Vite production build                         |
| `APP_URL=http://localhost:8443 npm --prefix web run test:e2e -- --grep 'teacher signup\|students cannot host\|solo presets\|phone layout, custom'` | 4 passed (25.2 seconds)                                                         |

The browser checks cover teacher signup and persistent login, student hosting denial, guest joining, mobile layout, custom question save/reuse, host-only play, newer-tab takeover, answer reveal, final standings, replay preparation and solo completion.

The transport integration suite covers transactional answer commits, ownership and recovery, HTTP/WebSocket session takeover, rollback on ledger insertion failure and Redis loss. Inspect [the tests](../../internal/transport/integration_test.go) for the precise assertions.

The [database output](database.txt) and [client receipt summary](demo-clients.json) are from the captured multiplayer room. They establish persisted answers and visible results for the local run. They do not measure production capacity or validate multiple application servers.
