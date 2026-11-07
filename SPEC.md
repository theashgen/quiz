# Quiz application — MVP product specification

**Version:** 1.0 — locked MVP baseline  
**Updated:** November 2, 2026  
**Status:** Agreed product scope and high-level architecture are locked. Explicitly open details are not approved defaults.

This document consolidates the product and system-design discussion. Confirmed requirements, proposed implementation choices, and unresolved decisions are separated below. Recording a decision here does not authorize implementation.

**Baseline rule:** Build against the confirmed requirements in this version. Do not add features or silently turn suggestions into requirements. Resolve open details when preparing the relevant implementation task; material changes to the baseline require the user's approval. Locking the scope does not mean every library, schema, or deployment detail has been chosen, or that capacity has been demonstrated.

## 1. Product overview

A responsive browser-based trivia application where friends or students join private rooms, start together, and answer questions at their own pace. Solo play is also available.

There are two multiplayer question sources, selected during room creation rather than through separate homepage modes:

- **Preset quizzes:** Friends play using built-in trivia categories.
- **Custom quizzes:** A teacher or other creator writes the questions and hosts the session without answering.

No login or signup is required anywhere in the MVP, including quiz creation and hosting.

## 2. Scope and roles

| Role | Capabilities | Participation rule |
| --- | --- | --- |
| Preset host | Configure the quiz, share the room code, start the game, and initiate another quiz | May answer questions or choose to host only |
| Custom host | Create and configure questions, share the room code, start the game, and initiate another quiz | Cannot answer their own quiz |
| Multiplayer player | Join with a room code, choose a username and avatar, answer questions, and view results | Must join before the quiz starts |
| Solo player | Select presets, configure the quiz, answer questions, and view results | No room code or waiting lobby required |

**Capacity requirement:** Support at least 150 answering players in a room, excluding a non-playing host. This is a minimum target, not a confirmed maximum or a claim of tested capacity.

## 3. Homepage and entry points

- Show a hero section with an image on one side and primary actions on the other, adapted for phone and laptop layouts.
- Provide **Create Room**, **Join Room**, and **Solo Play** entry points.
- Do not require authentication before or after any entry point.

The exact responsive layout, visual style, artwork, and avatar collection remain undecided.

## 4. Create and host a preset quiz

1. Choose **Create Room** and select preset questions.
2. Select one or multiple categories.
3. Select 5, 10, or 15 questions.
4. Set the per-question timer once for the entire quiz.
5. Choose whether to answer questions or host only.
6. Create the room and receive a shareable room code.
7. Wait in the lobby, which shows joined players and their avatars.
8. Start the quiz when ready.

Initial category examples: Science, General Knowledge, History, Computers, and Memes/Pop Culture. The final category catalog and preset content source are open decisions.

Preset questions cannot be edited by the room creator. All players receive the same selected question set, with a separately randomized question order for each player.

## 5. Create and host a custom quiz

1. Choose **Create Room** and select custom questions.
2. Clearly explain that the creator hosts but cannot answer the quiz.
3. Open the question editor.
4. Add at least one question, providing question text, four options, and exactly one correct option for each question.
5. Allow editing, deleting, and reordering questions before room creation.
6. Set the per-question timer once for the entire quiz.
7. Create the room, share its code, and wait in the lobby.
8. Start the quiz when ready.

Use all questions added to the custom quiz; no maximum custom question count has been chosen. Editor ordering organizes the authored quiz; gameplay still randomizes the question order independently for each player.

**Reuse requirement:** Creators should be able to reuse custom quizzes after a session without creating an account.

**Proposed storage approach:** Save reusable quizzes in the creator's browser using `localStorage`. This is a tentative implementation choice, not a finalized persistence design. The intended scope is browser-local reuse, not account sync or cross-device access. Retention, save behavior, and handling unavailable storage remain open.

## 6. Join a room

1. Choose **Join Room**.
2. Enter a room code.
3. Provide a username and select an avatar from the available collection.
4. Enter the lobby and wait for the host to start.

Show clear errors for invalid codes and rooms whose quiz has already started. New players cannot join an active quiz; existing participants may reconnect.

No friend accounts, social graph, or persistent profile is required by this flow.

## 7. Play solo

1. Choose **Solo Play**.
2. Select preset categories and a question count.
3. Configure the per-question timer.
4. Start without a room code or multiplayer lobby.
5. Answer questions using the same submission, timeout, and answer-reveal rules.
6. See the personal result after the final question.

Solo uses presets only. Whether solo requires username/avatar selection remains open.

## 8. Gameplay rules

| Setting | MVP rule |
| --- | --- |
| Question format | Four options, exactly one correct answer |
| Preset quiz length | 5, 10, or 15 questions |
| Custom quiz length | All authored questions, at least one |
| Question timer | Configured once and applied to every question |
| Default timer | 10 seconds per question |
| Multiplayer start | Everyone starts together when the host starts the quiz |
| Progression | Independent per player; never wait for others to answer |
| Question set | Same questions for everyone within a quiz |
| Question order | Independently randomized per player |
| Submission | Submit one answer to the current question |
| Answer reveal | Immediately show the correct answer after submission or timeout |
| Reveal duration | 2 seconds, then automatically advance |
| Feedback content | Correct answer only; no explanations or suggestions |
| Late joins | Block new players once the quiz starts |

Example: One player submits question 1 after 3 seconds, sees its correct answer for 2 seconds, then starts their next question. Another player can still be answering their own first question. Their question deadlines are independent.

Timer choices of 10, 20, 30, and 60 seconds were suggested during discussion. The 10-second default is confirmed; the complete allowed range still needs explicit confirmation.

## 9. Scoring and results

- Correct answer: **100 points**.
- Wrong answer or timeout: **0 points**.
- No speed bonus in the MVP.
- Equal scores share the same rank; precise rank numbering after ties is undecided.
- Show a player's own score immediately after they finish.
- Show the final leaderboard once every player has finished or their remaining questions have timed out.
- Keep results focused on score, rank, and leaderboard; detailed analytics are not required.

**Future requirement:** Leave room for a speed bonus without changing the basic gameplay flow. Separating scoring rules from progression and recording answer timing are suggestions for the later system-design discussion, not finalized implementation decisions.

## 10. Disconnections and completion

### Player disconnects

- Do not end an attempt immediately on disconnection.
- Keep the current question timer running; reconnecting grants no extra time.
- If the player stays disconnected, their unanswered questions continue to time out automatically for zero points.
- Allow reconnection while the attempt remains active.
- A player who never returns must not prevent the session from reaching final results.

The exact disconnected progression schedule, including the treatment of 2-second reveal periods, needs definition. Reconnection uses the confirmed anonymous guest session described in section 13; no login is required.

### Host disconnects

- Before the quiz starts, wait for the original host to reconnect; nobody else can start it.
- After the quiz starts, gameplay continues automatically without the host.
- A participating preset host follows the player-disconnection rules for their own attempt.

Host transfer, pause, manual question advancement, and additional moderation controls are not included in the current MVP scope.

## 11. Play again and room expiry

- After results, players can indicate that they want to play again.
- Show the host how many players are waiting for another quiz, such as “23 players want to play again.”
- The host can configure and start a new quiz using the same room.
- Keep each quiz's attempt and score separate from the next quiz in that room.
- Do not expire a room during an active quiz.
- Close an unstarted lobby if no quiz starts within 10 minutes. Joining or other activity does not extend this start deadline under the current interpretation.

**Proposed rematch behavior:** Preserve returning players' usernames and avatars. This was suggested but has not been explicitly confirmed.

The exact start of the post-results/rematch expiry window, eligibility for the next quiz, and whether new players may join between quizzes remain open. The latest proposed interpretation applies a 10-minute start deadline to rematch lobbies as well.

## 12. Screen inventory

| Screen | Main purpose |
| --- | --- |
| Homepage | Hero, create room, join room, and solo entry points |
| Question-source selection | Choose presets or custom questions |
| Preset setup | Categories, count, timer, and host participation |
| Custom editor and setup | Author questions, configure timer, and explain host-only participation |
| Join and player setup | Room code, username, and avatar selection |
| Lobby | Room code, player list, avatars, and host start action |
| Question | Current question, four options, submission action, and personal timer |
| Answer reveal | Correct answer for 2 seconds |
| Personal result | Player's score immediately after finishing |
| Final leaderboard and replay | Final ranks, replay interest, and host's next-quiz action |
| Room error or expiry | Clear reason and a path back to entry points |

A non-playing host's view during an active quiz is not yet defined. These are screen responsibilities, not finalized routes or layouts.

## 13. Technology direction

| Area | User-selected technology | Decision status |
| --- | --- | --- |
| Frontend | React with Vite | Selected; latest stable versions to be verified and pinned at implementation time |
| Backend | Go | Selected |
| Database | PostgreSQL | Authoritative durable gameplay and content records; schema undecided |
| Additional data infrastructure | Redis | Temporary coordination, presence, session lookups, and cached room views; detailed design undecided |

TypeScript, migration tooling, Docker Compose, and testing libraries are suggestions only. No exact versions or additional dependencies are selected by this document.

**Confirmed backend structure:** Start with one modular Go backend, not separate microservices. Organize responsibilities into internal modules for room management, quiz content, gameplay, scoring, and guest sessions. This describes application structure, not a permanent restriction to one running server instance.

**Confirmed communication approach:** Use HTTP for room creation, preset loading, custom quiz submission, and session snapshots. Use WebSockets for live session joining, lobby updates, start signals, answer submissions, per-player correct-answer feedback, and final leaderboard updates. Answer feedback and progression remain individual, not room-wide. Event formats, reconnect behavior, and the WebSocket library remain undecided.

**Confirmed gameplay authority:** The Go backend controls each player's deadlines, question progression, answer validation, and scoring. React displays the countdown and submits the selected option, not a score or correctness claim. Accept at most one answer per player per question; retries must not award points twice. Reveal the correct answer only after that player submits or times out. Disconnected progression continues on the backend, and reconnecting or refreshing must not reset a deadline. Exact deadline boundaries, reveal timing, and retry semantics will be specified later.

**Confirmed persistence split:** PostgreSQL is the source of truth for quiz configuration, fixed question snapshots (including custom quizzes), accepted answers, scores, and sufficient player progression/deadline information to recover a session. Persist question transitions, not per-second countdown ticks. Redis holds temporary presence, session lookups, cached room views, and live coordination; it is not the only record of earned points or recoverable gameplay state. Browser-local reusable custom quiz storage remains a tentative choice separate from active-session authority.

**Confirmed answer persistence:** Validate the submission and deadline, then record the accepted answer and resulting progress/score changes in one PostgreSQL transaction. Commit before acknowledging success. Enforce one accepted answer per quiz attempt and question using a database uniqueness constraint, and return the existing result for a retry. Refresh Redis's cached view after commit; a failed cache update must not undo an accepted answer or award points again. Cached gameplay views must be rebuildable from durable records. Transaction concurrency, event delivery, and reconciliation mechanics remain to be designed.

**Confirmed backend outage policy:** Show a reconnecting state while the backend is unavailable. After service returns, recover the saved session, keep original deadlines in force, apply missed timeouts, and restore each player to their resulting question or results screen. A backend outage does not pause the quiz or grant extra time, even though players may lose opportunities to answer during the outage. Recovery catch-up must account for per-player progression, answer-reveal periods, and missed question transitions. Recovery duration targets and detailed mechanics remain undecided.

**Confirmed guest identity:** Use backend-issued random anonymous session tokens stored in HttpOnly, Secure cookies with an appropriate SameSite policy. Associate each session with its player identity, quiz attempt, and host permissions where applicable. Restore an existing attempt using the session, not a username or room code. A room code permits joining an eligible lobby but never grants host authority. Validate permissions on every host action and answer submission, and validate WebSocket origins. MVP identity recovery is limited to the same browser while its session remains valid; switching devices or clearing cookies does not restore the previous identity. Session lifetimes, token rotation, revocation, and cookie policy details remain undecided. Multiple-tab behavior is confirmed below.

**Confirmed multiple-tab behavior:** Allow one active tab per player per room. Opening the same room in another tab restores the existing player, and the newer tab takes over without creating a duplicate participant. The old tab displays “This session is active in another tab” and cannot submit answers. Scores, progress, and deadlines remain unchanged. Enforce active-tab authority on the backend so stale connections cannot perform player or host actions; takeover must not cause displaced tabs to automatically reclaim authority through reconnect loops. Connection ownership and takeover mechanics remain to be designed.

The user retains system-design decisions. Detailed schemas, retention, scaling, hosting, recovery mechanics, session implementation details, and library choices remain undecided. The selected storage split has not yet been validated against the capacity target.

## 14. Acceptance criteria

- A guest can create, join, host, and play without login or signup on phone and laptop browsers.
- A preset host can choose multiple categories, a supported question count, and whether to participate.
- A custom creator can manage valid four-option questions before room creation but cannot answer that quiz.
- The lobby displays player usernames and avatars; the host controls the start.
- New players are rejected after start, while recognized existing players can reconnect.
- Players start together but advance independently, with the same set of questions in independently randomized order.
- Submission or timeout reveals the correct answer for 2 seconds before advancing that player.
- Correct answers award 100 points; incorrect or unanswered questions award zero; tied scores share a rank.
- Personal scores appear immediately on completion; final rankings appear only after all attempts finish or time out.
- Disconnections do not reset timers or leave the game permanently unable to finish.
- Host disconnection does not stop an active quiz.
- Replay interest is visible to the host, who can launch a new quiz in the existing room.
- Active quizzes do not expire; unstarted lobbies follow the agreed 10-minute deadline.
- Capacity is validated with at least 150 answering players in one room. Performance thresholds and the validated maximum are not yet specified.
- A custom creator can reopen a previously saved quiz within the agreed browser-local reuse scope.

These are future implementation checks, not claims that a working application or tests currently exist.

## 15. Open details outside the locked baseline

These details remain visible so the baseline can be locked without inventing approvals. They must be resolved before implementing or accepting the affected behavior, not necessarily before starting unrelated work.

1. Confirm all timer choices beyond the 10-second default.
2. Choose preset content sources, final categories, mixed-category distribution, and behavior when too few questions are available.
3. Set custom question limits and text/option validation rules.
4. Decide username validation, duplicate-name behavior, and when hosts and solo players choose identities.
5. Define exact disconnected progression and reveal timing. Same-browser guest recovery is confirmed; cross-device or cleared-cookie identity recovery is not part of the MVP.
6. Define the host-only active-game screen and minimum players needed to start.
7. Finalize browser-local quiz saving, reuse, deletion, and retention behavior.
8. Confirm rematch identity retention, participation changes, next-game roster, and post-results expiry timing.
9. Define rank numbering after ties and the maximum supported room capacity above the 150-player minimum.
10. Set measurable responsiveness, accessibility, and browser-support acceptance targets.
11. Choose a simultaneous-room load-testing target. At least 150 players per room is confirmed; no overall concurrent-player or room target has been approved.
12. Select TypeScript or JavaScript, supporting libraries, deployment topology, hosting, session lifetimes, and data-retention rules.

## 16. Deferred scope

- Login, signup, and account-based quiz synchronization.
- Speed-based scoring bonuses.
- New-player admission during an active quiz.
- Question formats other than four-option, single-answer multiple choice.
- Editing preset question content.
- Custom-question solo play.
- Detailed answer explanations, teaching suggestions, and analytics.
- Additional host controls beyond the agreed start and next-quiz flows.

## 17. Recommended next deliverables

The following are a proposed execution order, not authorization to implement or additional approved requirements:

1. Prepare an implementation blueprint: module boundaries, room/attempt state transitions, PostgreSQL schema, HTTP endpoints, WebSocket events, and timeout/retry/recovery rules.
2. Resolve the open details needed for the first build slice, including frontend language, initial preset content, and relevant validation rules.
3. Build one end-to-end preset multiplayer flow: create room, join, start, submit, reveal, advance independently, and show results.
4. Add custom quiz editing/reuse, solo play, replay, and the confirmed recovery and tab-takeover behavior.
5. Validate correctness, failure handling, and at least 150 players per room before claiming the capacity requirement is met.

No application implementation, deployment, or load testing has been performed as part of locking this specification.
