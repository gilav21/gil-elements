# Gil Elements

Framework-agnostic web components (Lit) with the look, feel and features of
[shadcn-angular](https://github.com/gilav21/shadcn-angular). Tag prefix `ge-`:
`<ge-badge variant="secondary" label="New"></ge-badge>`.

**Status: early.** Rung 1 of 10 is in: badge, kbd, label, separator, skeleton, spinner. Nothing is published yet.

## Layout

| Path | What it is |
| --- | --- |
| `packages/base` | `UiElement` base class, `defineElement`, `tokens.css` (same CSS variables as shadcn-angular) |
| `packages/elements` | One folder per element: `x.ts`, `x.css`, `define.ts`, `index.ts` |
| `parity/` | Pixel comparison against shadcn-angular's real Tailwind output |

A headless `core` package is added when the first component needs shared behaviour (rung 3, button/toggle).

## Using it

```html
<link rel="stylesheet" href="tokens.css" />   <!-- @gilav21/elements-base/tokens.css -->
<script type="module">import '@gilav21/elements/badge/define';</script>
<ge-badge>Beta</ge-badge>
```

Importing a class (`@gilav21/elements/badge`) never registers a tag; importing `.../define` does.

## Develop

```bash
pnpm install
pnpm run check          # typecheck, build, tests (Chromium + Node), size budget
node parity/run.mjs    # visual parity vs shadcn-angular (all components)
```

Rules that keep this library coherent:

- Plain CSS with the shared tokens. No Tailwind, no utility classes in the public API.
- `static properties`, assigned in the constructor. No decorators, so there is no compiler dependency.
- No DOM access in the constructor or `render()` (server rendering stays possible).
- Styling hooks are CSS variables and documented `part`s. Slots are the custom-content mode, attributes the simple mode.
- Every element ships with: browser tests, an axe check in light and dark, a server-render test, a parity check, and a size budget in `size-budget.json`.

## Licence

MIT
