# Validation record

Recorded locally on 2026-11-10. These results describe the working tree used for capture, including the ongoing Tailwind UI migration. They are not a public-deployment certification.

| Command                                                                                                                                                        | Result                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `go test -race ./...`                                                                                                                                          | Passed; database-dependent tests skip without a test database URL               |
| `TEST_DATABASE_URL=postgres://quiz:local-quiz-only@localhost:55432/quiz?sslmode=disable TEST_REDIS_URL=redis://localhost:56379/0 go test -race -count=1 ./...` | Passed, including transport integration tests against isolated database schemas |
| `npm --prefix web run build`                                                                                                                                   | Passed TypeScript compilation and Vite production build                         |
| `APP_URL=http://localhost:8443 npm --prefix web run test:e2e -- --grep 'teacher signup\|students cannot host\|solo presets\|phone layout, custom'`             | 4 passed (25.2 seconds)                                                         |

The browser checks cover teacher signup and persistent login, student hosting denial, guest joining, mobile layout, custom question save/reuse, host-only play, newer-tab takeover, answer reveal, final standings, replay preparation and solo completion.

The transport integration suite covers transactional answer commits, ownership and recovery, HTTP/WebSocket session takeover, rollback on ledger insertion failure and Redis loss. Inspect [the tests](../../internal/transport/integration_test.go) for the precise assertions.

The [database output](database.txt) and [client receipt summary](demo-clients.json) are from the captured multiplayer room. They establish persisted answers and visible results for the local run. They do not measure production capacity or validate multiple application servers.
