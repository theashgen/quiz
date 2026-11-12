# Frontend components

The frontend uses shadcn/ui's Base UI (`base-nova`) registry with React,
Vite and Tailwind CSS v4. Configuration lives in `components.json`; both
TypeScript and Vite resolve `@/` to `src/`.

From `web/`, install components with:

```sh
npx shadcn@4.23.0 add button button-group input dropdown-menu
```

Registry components live in `src/components/ui/`. Keep the existing
Peach Playground appearance when adapting them: retain the explicit
Tailwind layers in `src/tailwind.css`, do not introduce Preflight or a
global shadcn theme reset, and use the existing CSS classes for visuals.
The migration intentionally keeps the current fonts, colors, dotted
background, layout and responsive behavior rather than applying a new theme.

Button, Button Group, Input and Dropdown Menu are installed and used by
the homepage; Separator is included as a Button Group dependency. Their
Button and menu recipes are customized to the existing CSS rather than the
registry's default theme. The homepage room-code Input uses the stock shadcn
recipe with the existing brand colors and a 44px touch target. Other forms
keep their existing appearance through the Input's `themed` variant.
The legacy `Button` adapter preserves existing `intent`,
`size`, `fullWidth` and native submit defaults for other screens.
When updating registry components, review the generated diff before accepting
it so the customized recipes and shared `@/lib/utils` import are retained.

Shared screens also use shadcn Textarea, Label, Checkbox, Radio Group and
Dialog. Header/navigation buttons, authentication forms, setup controls,
join fields and room actions use these source components rather than raw
UI controls. The `unstyled` Button variant keeps existing navigation,
avatar and segmented-control CSS intact. Avatar browsing uses shadcn Dialog
for focus management, Escape dismissal and its portal.

The minimal header shows a teacher-only **Question bank** shortcut to
`/create?source=custom`, opening the existing custom-question editor directly.
Guests and students do not see this shortcut. The homepage omits the old
navigation and footnote, and its Create a room trigger has no motion effects.

On mobile and coarse-pointer touch devices, page workspaces allow vertical
scroll chaining to the document so native browser pull-to-refresh is not
blocked. Viewport wrappers use `overflow: clip` instead of hidden scroll
containers without changing their dimensions. Keep modal scroll locking
separate; the avatar dialog still manages its own focus and scrolling.
Native refresh availability depends on the browser and display mode.

Solo and multiplayer results both use `Leaderboard` and the `podium-results`
layout. Solo keeps its own result wording and replay action, with only the
actual player on the podium; do not create a separate solo leaderboard or
duplicate the shared podium styles.

Validate with `npm run build` and `npm run test:e2e`. Set `APP_URL` to the
application instance serving this checkout when running browser tests.
