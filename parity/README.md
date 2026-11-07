# Parity checks

`run.mjs` compiles shadcn-angular's real class strings with Tailwind (so it compares against what
the Angular library paints), renders `<ge-badge>` beside it for each variant in light and dark, and
fails on any differing pixel.

Reference pinned to shadcn-angular commit `d6d7cfd`. The class strings in `cases/*.mjs` are copied by hand from the Angular components; a generated parity matrix will replace the hand copy.

Both pages get the two layout-affecting parts of Tailwind's preflight (`box-sizing`, `line-height`), because an Angular app has them and a bare page does not. Animations are frozen at the same instant (700 ms unless a case sets `at`), shadow roots included, so keyframes and delays are compared too.

Pages render in parallel on a pool of Chromium processes (`PARITY_WORKERS`, default `min(12, cores - 2)`; `1` is the old serial run). Each page is compared as soon as both sides are done, and the screenshots of passing cases are not written (`PARITY_KEEP=1` writes them all). A full run (about 2900 comparisons) takes about 2 minutes on 32 cores, down from 13 serial.
