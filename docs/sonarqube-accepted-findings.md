# SonarQube: accepted findings

Only genuine false positives are excluded, in `sonar-project.properties`, with the reason here.

## typescript:S4624 (nested template literals) in `packages/**`

Lit renders conditionals as `${cond ? html`<a></a>` : nothing}`. Sonar reads the inner `html` tagged template as a
template literal nested in a template literal. No string is built from it: the inner template is a value handed to Lit,
and splitting it out would only move the same expression into a helper. The rule stays on for `apps/` and `scripts/`.

## typescript:S1874 (deprecated API) in `packages/elements/src/rich-text-editor/**`

`document.execCommand` and `queryCommandState` are marked deprecated, but they are still the only way to apply and
read inline and block formatting in a `contenteditable` (undo integration, selection handling and browser parity come
with them). The editor uses them on purpose, as the Angular original does; there is no replacement to migrate to.

## typescript:S4325 (unnecessary type assertion) in `sortable/sortable.ts` and `radio-group/radio-group.ts`

False positive. Removing the casts makes the compiler fail (TS2769 and TS2345), so they are required.

## typescript:S7741 (`typeof x === 'undefined'`) in `file-viewer/parsers/pdf-pixel-perfect.ts`

False positive. A bare `module !== undefined` throws a ReferenceError where `module` is not declared (the browser
bundle); the `typeof` guard is what makes the check safe.

## typescript:S7747 (spread of an iterable in `for...of`) in `rich-text-editor/rich-text-registry.ts`

The listener sets are copied before iterating on purpose: a listener may unsubscribe or subscribe while the loop runs,
and iterating the live set would skip or revisit entries.
