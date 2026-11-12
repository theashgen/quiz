# Frontend components

The frontend uses shadcn/ui's Base UI (`base-nova`) registry with React,
Vite and Tailwind CSS v4. Configuration lives in `components.json`; both
TypeScript and Vite resolve `@/` to `src/`.

From `web/`, install components with:

```sh
npx shadcn add button button-group input dropdown-menu
```

Registry components live in `src/components/ui/`. Keep the existing
Peach Playground appearance when adapting them: retain the explicit
Tailwind layers in `src/tailwind.css`, do not introduce Preflight or a
global shadcn theme reset, and use the existing CSS classes for visuals.
The migration intentionally keeps the current fonts, colors, dotted
background, layout and responsive behavior rather than applying a new theme.

Validate with `npm run build` and `npm run test:e2e`. Set `APP_URL` to the
application instance serving this checkout when running browser tests.
