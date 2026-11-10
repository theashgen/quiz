# Reproduce the portfolio captures

The README media uses the real application, local backend and durable database. The multiplayer round has **12 answering players**: Ada in a browser and 11 automated protocol clients. A separate teacher hosts without answering. Synthetic names and example.test accounts are demonstration data.

## Capture the workflow

Start infrastructure and the backend using [the development guide](../development.md), then build the frontend. The default capture target is the built app served over local HTTP on port 8443.

```sh
npm --prefix web ci
npm --prefix web run build
npm --prefix web exec playwright install chromium
node docs/demo/capture.cjs
node docs/demo/capture-states.cjs
python3 docs/demo/render-video.py
node docs/demo/backend-evidence.cjs
```

Video encoding requires `ffmpeg` and `ffprobe` on PATH. The backend evidence image requires `psql` on PATH (or an absolute path in `PSQL`) and a reachable database; `DATABASE_URL` defaults to the development connection.

The script creates fresh teacher/student accounts and a room; takes full-page screenshots at a 1440 × 1000 desktop viewport with 2× pixel density; records real browser interaction; and captures 390 × 844 mobile views. Raw recordings go under ignored `.local/`. Published PNGs go in `docs/media/screenshots/`. It never alters frontend state to manufacture a result. The 11 protocol clients use the WebSocket bundle shipped with the pinned Playwright version.

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

The first showcased round should have 36 answer records, 12 distinct player sessions and one null-choice timeout. The per-player sums must match the captured leaderboard. The SQL deliberately excludes session tokens, token hashes, account credentials and emails.

## Media presentation

The video combines the teacher, player and solo recordings in workflow order. It uses H.264 in an MP4 container with the index moved to the front for playback. Browser chrome, developer tooling and idle setup are excluded. No promotional footage or invented product screens are used. The recording is silent so the application remains the focus.

The README links a clickable poster to the versioned MP4. GitHub-style README renderers do not consistently allow an HTML video player. This works without a separate video-hosting account; viewers can open the file and use the raw/download action when required.

The gallery covers the main product states and validation/recovery paths. Supplemental screenshots use isolated fixtures: a controlled WebSocket disconnect plus browser offline mode triggers reconnection; a newly created lobby has its database expiry shortened to trigger the unchanged server expiry worker; and a separate browser context rejects local-storage writes to show the save failure. These fixture images are excluded from the multiplayer video. Brief pending-submission states are not presented as a separate screen; the gallery is not an exhaustive test matrix.
