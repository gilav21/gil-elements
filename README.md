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

## Where Gil Elements differs from the Angular library, on purpose

- **`heading`, not `title`.** On a custom element `title` is a native attribute and shows a tooltip over the whole component, so simple-mode titles (card, alert, page header) use `heading`.
- **Named slots instead of sibling selectors.** An alert's icon goes in `slot="icon"`, a card header's control in `slot="action"`, a page header's trail in `slot="breadcrumb"`. `::slotted()` takes no combinators, so Angular's `[&>svg~*]` has no equivalent.
- **`bordered` instead of a `border-b` class.** `ge-card-header` and `ge-card-footer` take a `bordered` attribute that adds the divider and its padding; there is no Tailwind to detect a class. The padding is 1rem, not Angular's 1.5rem, because beside the card's own 1.5rem gap the larger one looks bloated. The Angular demo shows no dividers, so this is an extra, not a parity feature.
- **Avatar watches a plain `<img>`.** There are no `avatar-image` or `avatar-fallback` sub-elements: slot your own `<img>` and a `fallback` slot, and the avatar follows the image's load and error events.
- **Joined buttons read CSS variables.** A `ge-button`'s box is inside its own shadow root, out of reach of `::slotted()`, so `ge-button-group` sets `--ge-join-*` custom properties on its items and the button reads them. A plain `<button>` is not joined, because a page's own styles on it would win over anything the group says from its shadow root.
- **`ge-button` is form-associated** (`ElementInternals`): `type="submit"` and `type="reset"` act on the surrounding form. It does not contribute `name`/`value` to form data.
- **A `ge-button` draws no box of its own** (like the Angular one, its host is `display: contents`), so margins, `slot` placement and grid or flex item properties go on a wrapper element.

## Licence

MIT

## Demo

`pnpm demo` starts the demo app (`apps/demo`): a sidebar of every element, live examples with copy-paste markup, an API table, and light/dark, RTL and density controls. Each example is one HTML string rendered live and shown as code, so the two cannot drift. Add a new element's page by appending to `apps/demo/src/demos.ts`.
