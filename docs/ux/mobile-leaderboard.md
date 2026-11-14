# Mobile leaderboard layout proposal

Scope: layout and UX for multiplayer final results at phone widths. Preserve the current palette, fonts, avatars, podium artwork, button variants, and desktop layout. The accompanying HTML is a neutral wireframe, not a replacement visual design. The layout is now implemented on `fix/mobile-leaderboard-ux`; the HTML remains the original concept wireframe.

## Content order

1. Existing site header.
2. One final leaderboard heading, room code, and player count. Consolidate the current duplicated result introductions.
3. Participating player's rank and score, plus a Find me action. Omit this summary for a nonplaying host. Do not invent ranks for missing entries.
4. Compact 2–1–3 podium using the existing components. Target about 200–240px including avatars and names; allow more height for wrapped names. Preserve explicit rank numbers and points.
5. Standings starting at fourth place, keeping the existing highlighted current-player row. Keep points right aligned and let names wrap. For players in the podium, Find me targets their podium entry.
6. Final-score note after the standings.
7. Persistent bottom action area with replay count, the role-specific primary action, and Back to home.

## Behavior

- Use a single page scroll on mobile; no separately scrolling standings list. The preview's phone viewport simulates the page scroll.
- Keep the action area outside the scrollable content with space reserved for its full height. Account for the device safe area. Never overlay or conceal the last standing.
- A player sees Count me in for another. After opting in, replace the action with the existing waiting status. A nonplaying host sees Set up the next quiz. Preserve a participating host's opt-in capability as a secondary action.
- When the host starts preparing, keep results available and announce the existing preparation status.
- Find me scrolls to the player's entry and moves keyboard focus there without trapping it. Omit the action when no entry exists.
- Preserve tied rank values. Handle zero, one, two, and three players without empty podium placeholders or an empty standings heading.
- Solo results retain their separate flow; this proposal focuses on multiplayer leaderboard UX.

## Implementation acceptance checks

Check widths 320, 360, 390, and 430px; short 568px screens; long names; large point values; 200% text zoom; and 0/1/2/3/10/150-player results. Verify no horizontal overflow, 44px minimum action targets, no clipped focus outlines, complete access to the final standing, replay state feedback, and unchanged desktop layout.


## Implementation notes

- Results use one scrollable workspace with a content-sized replay area outside it. At heights of 600px or less, or when the rendered replay area exceeds 40% of the results viewport, the whole result scrolls together so actions cannot consume the screen. A Next round actions shortcut keeps replay discoverable without traversing the standings. Safe-area padding is included.
- Narrow phones (360px or less) put the standings score below the name, right aligned, to make long names and enlarged text readable. Other phone widths keep the existing row composition.
- Podium names use two visible lines; full names remain in the accessible entry label and title. Original avatars, palette, typefaces, podium artwork, and button variants are retained.
- Find me targets either the podium or standings entry, moves focus, and announces rank and score. Ties retain their supplied rank via list-item values.
- Nonplaying hosts see setup; participating hosts retain replay opt-in. Waiting and preparing states retain the existing server commands and announcements.
- Desktop retains its scrollable, keyboard-focusable standings list; mobile removes that extra list focus stop. Solo results retain their original layout.

Validation: production build passed; all 24 Playwright leaderboard checks passed against Vite and the local backend. Coverage includes desktop/solo regressions, phone widths 320/360/390/430px, 150-player standings, replay transition, preparing status, tied ranks, missing personal entries, 0–3 players, and enlarged text at 320×568. These are automated assertions; no manual device or screen-reader audit has been performed.


## Independent implementation reviews and follow-up

GLM independently reproduced the build and 24-test suite, rated the reviewed implementation 8.5/10, and found no blockers. DeepSeek independently reproduced those checks and rated it 8/10, identifying enlarged-text podium overflow and dock/focus improvements. These ratings apply to the implementation reviewed before the follow-up fixes.

Follow-up changes stack and wrap podium score/place labels, switch oversized docks to the full scroll flow using their measured height, provide a shortcut to replay actions, preserve focus on replay confirmation, use the existing deep-peach focus token with inset control outlines, and provide a level-two standings heading on mobile. A persistent live region announces host preparation.

Final validation: production build passed and all 30 leaderboard Playwright tests passed. Added checks measure individual podium text fragments inside their columns at 320/360/390/430px with enlarged text, cover the 390×640 height band, and exercise action shortcuts and confirmation focus with 150 players on a 320×568 screen. Enlarged-text CSS simulation remains a proxy, not a manual browser-zoom, device, visual, or screen-reader audit.
