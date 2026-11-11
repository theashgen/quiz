# Reproduce the portfolio captures

The README media uses the real application, local backend and durable database. The multiplayer round has **12 answering players**: Ada in a browser and 11 automated protocol clients. A separate teacher hosts without answering. Synthetic names and example.test accounts are demonstration data.

The current assets were refreshed on **November 11, 2026**, using the approved **Peach Playground** UI with the podium proportion fix at application revision `d06a941`. The follow-up centers the desktop podium, scales the steps to the available height and keeps the ranks visible without a transparent fade. Scoring, gameplay and backend behavior are unchanged. Run commands from the repository root, and ensure the served frontend build matches the checkout you want to capture. This run used an isolated local instance at `http://localhost:8444`; the default below remains port 8443.

## Capture the workflow

Start infrastructure and the backend using [the development guide](../development.md), then build the frontend. The default capture target is the built app served over local HTTP on port 8443.

```bash
npm --prefix web ci
npm --prefix web run build
npm --prefix web exec playwright install chromium
export APP_URL=http://localhost:8443
export DATABASE_URL='postgres://quiz@localhost:55432/quiz?sslmode=disable'
read -r -s PGPASSWORD
export PGPASSWORD
node docs/demo/capture.cjs
node docs/demo/capture-states.cjs
python3 docs/demo/render-video.py
node docs/demo/backend-evidence.cjs
node docs/demo/verify-media.cjs
unset PGPASSWORD
```

Video encoding and verification require `ffmpeg` and `ffprobe` on PATH. The backend evidence image and isolated expiry fixture require `psql` on PATH (or an absolute path in `PSQL`) and a reachable database. Adapt `DATABASE_URL` to your local setup and enter the database password at the silent `read` prompt; do not paste it into source files or logs. If local authentication needs no password, omit the `read` and `PGPASSWORD` lines. Never point these fixture scripts at production: `capture-states.cjs` deliberately expires only its freshly created local lobby.

The scripts create fresh teacher/student accounts and a room; take full-page screenshots at a 1440 × 1000 desktop viewport with 2× pixel density; record real browser interaction; and capture 390 × 844 mobile views. The generated backend report uses a 1200 × 1100 viewport and is explicitly labelled as a report, not an app screen. Raw recordings go under ignored `.local/`. Published PNGs go in `docs/media/screenshots/`. The scripts never alter frontend state to manufacture a result. The 11 protocol clients use the WebSocket bundle shipped with the pinned Playwright version.

All 35 earlier states are retained, plus six mobile captures: the actual 12-player host lobby, podium, scrolled standings, and a separate mobile solo question, reveal and completed result. The host's non-recorded control page is resized for the mobile multiplayer images; the visible guest video stays at desktop size. Native workspace scrolling is preserved. The mobile solo run is supplemental, not spliced into the desktop workflow video.

`screenshot.cjs` waits for fonts and image decoding, rejects broken images and document-level horizontal overflow, and records each asset's dimensions, revision and timestamp in `docs/evidence/screenshots.json`. It does not certify every internal scroll container or replace visual inspection. `verify-media.cjs` checks all 41 PNGs against that manifest, resolves documentation links, checks video metadata/chapters and decodes the entire MP4. It also creates screenshot contact sheets and a four-second video sampling sheet in `.local/media-review/`; inspect those and open full-size images for small text before publishing. An interrupted recording longer than 150 seconds fails verification rather than silently replacing a clean demo.

The three custom questions are included in `capture.cjs`, with option A marked correct. Automated guests vary answer choices and response delays to exercise real scoring and tied ranks. Ada submits one correct and one incorrect answer and lets one deadline expire. A five-question solo round is recorded separately.

`players.cjs` can also populate a manually created lobby:

```sh
node docs/demo/players.cjs ABC123
```

Replace `ABC123` with the actual six-character lobby code. Keep it running until the results appear; Ctrl-C closes its connections. It joins 11 players, so join with one browser guest for the demonstrated total of 12. It is tailored to the three showcase questions whose first option is correct; do not use it to assert correct-answer scoring for arbitrary quizzes.

## Verify persistence

Read the generated room code in `docs/evidence/room.json`. Run the read-only SQL against your local database:

```sh
psql "$DATABASE_URL" -v room=ABC123 -f docs/demo/verify.sql
```

The first showcased round should have 36 answer records, 12 distinct player sessions and one null-choice timeout. The per-player sums must match the captured leaderboard. `backend-evidence.cjs` checks the room identity, all 11 clients' three acknowledged answers, and every player score in each client's 12-entry final leaderboard against PostgreSQL. The SQL deliberately excludes session tokens, token hashes, account credentials and emails.

## Media presentation

The video combines the teacher, player and solo recordings in workflow order. It uses H.264 in an MP4 container with the index moved to the front for playback. Browser chrome, developer tooling and idle setup are excluded. No promotional footage or invented product screens are used. The recording is silent so the application remains the focus.

The README links a clickable poster to the versioned MP4. GitHub-style README renderers do not consistently allow an HTML video player. This works without a separate video-hosting account; viewers can open the file and use the raw/download action when required.

The gallery covers the main product states and validation/recovery paths. Supplemental screenshots use isolated fixtures: a controlled WebSocket disconnect plus browser offline mode triggers reconnection; a newly created lobby has its database expiry shortened to trigger the unchanged server expiry worker; and a separate browser context rejects local-storage writes to show the save failure. These fixture images are excluded from the multiplayer video. Brief pending-submission states are not presented as a separate screen; the gallery is not an exhaustive test matrix.

The loading image is also intentional: a delayed catalog response captures the loading screen. It is not a failed capture. Other product screenshots wait for their expected usable state. Use a local instance without concurrent end-to-end suites: fresh demo accounts count toward the unchanged authentication throttle. If a capture is interrupted or the machine sleeps, rerun it before encoding rather than publishing a partial or idle recording.
