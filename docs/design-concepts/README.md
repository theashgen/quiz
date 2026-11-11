# Quiz design concepts

These locally rendered UI mockups explored three directions before implementation:

- **A — Peach Playground** (`a-warm.png`): approved direction. Cream canvas, orange actions, rounded white cards, colorful avatar tiles, and a playful podium.
- **B — Arcade** (`b-arcade.png`): violet, high-energy alternative with a navigation rail.
- **C — Mint** (`c-mint.png`): quieter green alternative with a centered hero.

Open `gallery.html` to compare the concepts. These are static design studies; the application in `web/` implements the approved direction with real quiz flows.

To regenerate from the repository root after installing the web dependencies:

```sh
python3 docs/design-concepts/generate.py
node docs/design-concepts/render.cjs
```

The scripts embed the existing local fonts and avatar assets and render PNGs using the project's Playwright dependency. No image-generation API key is needed.
