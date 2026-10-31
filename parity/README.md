# Parity checks

`badge.mjs` compiles shadcn-angular's real class strings with Tailwind (so it compares against what
the Angular library paints), renders `<ge-badge>` beside it for each variant in light and dark, and
fails on any differing pixel.

Reference pinned to shadcn-angular commit `d6d7cfd`. `badge-reference.html` holds the class strings,
copied from `badge.component.ts`; a generated parity matrix will replace the hand copy.
