<img src="assets/icon.svg" width="48" height="48" alt="Quiz icon">

# Quiz

**A full-stack multiplayer trivia app: create a quiz, invite a room, play against the clock, and see the results live.**

Built with **React · TypeScript · Go · WebSockets · PostgreSQL · Redis**. Teachers host preset or custom quizzes; students and anonymous guests join with a six-character code. Solo play works without an account.

[Watch the full walkthrough](docs/media/video/quiz-walkthrough.mp4) · [Explore every captured state](#application-walkthrough) · [Verify the backend](#backend-you-can-verify) · [Run locally](#run-locally)

**Deploy:** [Railway setup with PostgreSQL and Redis](docs/railway.md).

[![Quiz — 12-player multiplayer room](docs/media/screenshots/08-player-lobby.png)](docs/media/video/quiz-walkthrough.mp4)

## Watch someone use it

**[Play the workflow video →](docs/media/video/quiz-walkthrough.mp4)** · 82 seconds · 1440 × 1000 · 30 fps · 9.5 MB

Video chapters: **0:00** teacher signup and quiz creation · **0:16** guest joins the 12-player round · **1:00** solo play.

The recording follows teacher signup and quiz creation, then a guest joining a **12-player room**, answering questions, receiving feedback, timing out, viewing the final standings, and opting into another round. A solo round follows. It uses the running Go service, PostgreSQL and Redis.

The room contains **one browser-driven player and 11 automated guest clients**, plus a teacher hosting without playing. Each guest has an independent session and live WebSocket connection. These are local demonstration clients, not a claim of 12 human users. See the [capture and reproduction notes](docs/demo/README.md).

The MP4 is linked through a clickable screenshot because repository README renderers do not consistently support inline video playback. Open the link to play or download it.

## What this project demonstrates

| Area                     | Implementation                                                                                    | Where to inspect                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Product UI               | Responsive onboarding, avatar selection, quiz editor, lobby, timed questions and podium standings | [React components](web/src/components)                                                                                       |
| Identity and permissions | Teacher/student accounts; anonymous guest sessions; hosting checks on the server                  | [Authentication contract](docs/auth.md), [account code](internal/accounts), [HTTP authorization](internal/transport/auth.go) |
| Real-time interaction    | WebSocket snapshots, command acknowledgements, reconnects and newer-tab ownership                 | [Browser connection lifecycle](web/src/useRoom.ts), [server transport](internal/transport/server.go)                         |
| Durable scoring          | Row-locked transactions; accepted-answer ledger; retry-safe submissions                           | [Storage](internal/storage/storage.go), [integration tests](internal/transport/integration_test.go)                          |
| Game rules               | Server-owned 10-second deadlines, 2-second reveals, 100 points per correct answer, tied ranks     | [Gameplay](internal/gameplay), [scoring](internal/scoring)                                                                   |
| Repeatable delivery      | Versioned migrations, container setup, browser tests and a protocol load harness                  | [Migrations](migrations), [Compose](compose.yaml), [tests](web/tests), [load client](cmd/loadtest)                           |

## Application walkthrough

These are captures of the actual application, with browser chrome excluded. Click any image for the full-resolution file. The expanded views cover the main workflow; additional account, mobile and recovery states are grouped below.

### 1. Arrive, register and create a quiz

| Home                                                                                      | Teacher or student signup                                                              |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| ![Landing page with host, join and solo entry points](docs/media/screenshots/01-home.png) | ![Account signup with teacher and student roles](docs/media/screenshots/02-signup.png) |

| Ready-made trivia                                                                             | Custom quiz editor                                                                                                                    |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| ![Preset setup with category and length controls](docs/media/screenshots/04-preset-setup.png) | ![Custom questions with four answers, correct-answer selection and browser-local saving](docs/media/screenshots/05-custom-editor.png) |

Custom quizzes can be reordered, duplicated and explicitly saved in the browser. **Save a copy** uses local storage; it does not sync quizzes to the account. Teacher role selection is self-declared, not verified by an institution.

### 2. Join a room and bring the group together

| Guest identity and room code                                                          | Host view: 12 players ready                                                                             |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| ![Guest chooses a name and avatar before joining](docs/media/screenshots/07-join.png) | ![Teacher lobby showing twelve players and the start control](docs/media/screenshots/09-host-lobby.png) |

The host controls the start. Joining does not extend the lobby's 10-minute expiry. The teacher can host without answering; all 12 players take part in the captured round.

### 3. Answer, learn and see the standings

| Live question                                                                                    | Answer feedback                                                                                         |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| ![Four-option question with server-controlled countdown](docs/media/screenshots/10-question.png) | ![Correct answer highlighted after a committed submission](docs/media/screenshots/12-answer-reveal.png) |

![Final leaderboard for the twelve-player room](docs/media/screenshots/13-leaderboard.png)

Each player receives the same questions in a different order. The server reveals the answer after submission or timeout. The final leaderboard includes every player and preserves tied competition ranks.

### 4. Play again or go solo

| Opt into the next round                                                                                  | Personal solo result                                                               |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| ![Player opts into another quiz while waiting for the host](docs/media/screenshots/15-replay-opt-in.png) | ![Solo score and another-round action](docs/media/screenshots/24-solo-results.png) |

<details>
<summary><strong>Account, identity and mobile screens</strong></summary>

| State               | Screenshot                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| Teacher account     | ![Teacher account details and actions](docs/media/screenshots/03-account.png)                                |
| Sign in             | ![Sign-in form](docs/media/screenshots/22-login.png)                                                         |
| Avatar gallery      | ![Full avatar selection dialog](docs/media/screenshots/06-avatar-picker.png)                                 |
| Solo setup          | ![Solo category and length selection](docs/media/screenshots/23-solo-setup.png)                              |
| Mobile home (390px) | <img src="docs/media/screenshots/29-mobile-home.png" width="300" alt="Home page at a mobile viewport">       |
| Mobile join (390px) | <img src="docs/media/screenshots/30-mobile-join.png" width="300" alt="Guest join page at a mobile viewport"> |

</details>

<details>
<summary><strong>Answer, host, replay and recovery states</strong></summary>

| State                   | Screenshot                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| Selected answer         | ![Selected option before submission](docs/media/screenshots/11-selected-answer.png)                             |
| Incorrect answer reveal | ![Correct answer shown after an incorrect selection](docs/media/screenshots/19-incorrect-reveal.png)            |
| Urgent timer            | ![Countdown near the server deadline](docs/media/screenshots/20-timer-urgent.png)                               |
| Timeout reveal          | ![Answer reveal after no answer was submitted](docs/media/screenshots/21-timeout-reveal.png)                    |
| Host watches progress   | ![Host-only progress while players answer](docs/media/screenshots/18-host-live-progress.png)                    |
| Host final standings    | ![Results shown to the teacher](docs/media/screenshots/14-host-results.png)                                     |
| Host preparing replay   | ![Player notice while host configures the next round](docs/media/screenshots/16-host-preparing.png)             |
| Next lobby              | ![Player enrolled in the next lobby](docs/media/screenshots/17-next-lobby.png)                                  |
| Unknown room            | ![Server error for a room code that does not exist](docs/media/screenshots/25-room-not-found.png)               |
| Invalid credentials     | ![Sign-in error from the authentication endpoint](docs/media/screenshots/26-login-error.png)                    |
| Student hosting denied  | ![Student account redirected away from teacher-only hosting](docs/media/screenshots/27-student-permissions.png) |
| Newer-tab takeover      | ![Older tab yields control to the newer session](docs/media/screenshots/28-tab-takeover.png)                    |
| Connection recovery     | ![Reconnecting notice with the room preserved](docs/media/screenshots/32-reconnecting.png)                      |
| Expired lobby           | ![Server expires an isolated lobby fixture](docs/media/screenshots/33-expired-lobby.png)                        |
| Browser save failure    | ![Editor retained after local storage rejects a save](docs/media/screenshots/34-save-failure.png)               |
| Initial loading         | ![Loading while the initial catalog request is pending](docs/media/screenshots/35-loading.png)                  |

The recovery images use isolated fixtures; see [capture notes](docs/demo/README.md) for how network loss, expiry and storage failure are triggered.

</details>

## Backend you can verify

The UI runs against a modular Go server. PostgreSQL is the source of truth for room state and accepted answers. Redis provides disposable coordination and caching; losing Redis does not erase committed points.

| Evidence                                                                                      | What it establishes                                                                                              |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| [Database query output](docs/evidence/database.txt) and [read-only SQL](docs/demo/verify.sql) | The demonstrated room's player count, answer records, timeouts and per-player scores                             |
| [Guest-client receipts](docs/evidence/demo-clients.json)                                      | Eleven separate protocol clients received answer acknowledgements and a twelve-player final leaderboard          |
| [Validation record](docs/evidence/validation.md)                                              | Commands and results for Go race tests, PostgreSQL/Redis integration tests, frontend build and browser workflows |
| [Reproducible capture](docs/demo/capture.cjs)                                                 | Real signup, room creation, guest joining, answers, results, replay and solo navigation                          |

![Backend verification from the recorded room](docs/media/screenshots/31-backend-evidence.png)

To follow an answer through the code: [the browser sends a command](web/src/useRoom.ts), [Go checks identity and game state](internal/transport/server.go), [storage commits the answer and room update together](internal/storage/storage.go), and the server publishes the updated view. Accepted-answer uniqueness prevents a retried submission from scoring twice. Correct answers are excluded from the live question view until the player's submission or timeout.

## Run locally

Prerequisites: Docker Compose v2 and OpenSSL.

```sh
make up
```

Open **https://localhost:8443** and accept the local self-signed certificate. Create a teacher account to host, or join as a guest. No external API or paid service is required.

For hot reload, native dependencies, configuration and troubleshooting, see [development and operations](docs/development.md). The [product specification](SPEC.md) and [authentication contract](docs/auth.md) describe the behavior in more detail.

```sh
make test         # Go race tests and TypeScript checks
make integration  # Isolated PostgreSQL schemas and Redis integration
make e2e          # Browser workflows; requires a running app and Chromium
```

## Scope and limitations

This is a locally validated portfolio project. The 12-player recording demonstrates the application workflow; it is not a production capacity benchmark. The separate [load harness](cmd/loadtest) supports larger synthetic runs.

Room state currently uses a row-locked JSONB aggregate plus a relational answer ledger. Production deployment, automatic durable-data deletion, session rotation/revocation controls, formal accessibility targets, content review and physical-device/cross-browser certification need further work. Mobile images show Chromium viewport checks, not physical-phone certification.
