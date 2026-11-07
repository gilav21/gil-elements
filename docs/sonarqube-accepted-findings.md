# SonarQube: accepted findings

Only genuine false positives are excluded, in `sonar-project.properties`, with the reason here.

## typescript:S4624 (nested template literals) in `packages/**`

Lit renders conditionals as `${cond ? html`<a></a>` : nothing}`. Sonar reads the inner `html` tagged template as a
template literal nested in a template literal. No string is built from it: the inner template is a value handed to Lit,
and splitting it out would only move the same expression into a helper. The rule stays on for `apps/` and `scripts/`.
