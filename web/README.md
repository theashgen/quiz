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
recipes are customized to the existing CSS rather than the registry's
default theme. The legacy `Button` adapter preserves existing `intent`,
`size`, `fullWidth` and native submit defaults for other screens.
When updating registry components, review the generated diff before accepting
it so the customized recipes and shared `@/lib/utils` import are retained.

Validate with `npm run build` and `npm run test:e2e`. Set `APP_URL` to the
application instance serving this checkout when running browser tests.
