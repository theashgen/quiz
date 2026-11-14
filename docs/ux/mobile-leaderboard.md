# Mobile leaderboard layout proposal

Scope: layout and UX for multiplayer final results at phone widths. Preserve the current palette, fonts, avatars, podium artwork, button variants, and desktop layout. The accompanying HTML is a neutral wireframe, not a replacement visual design. Application code has not been changed.

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
