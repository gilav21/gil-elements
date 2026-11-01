// shadcn-angular collapsible.component.ts, sub/collapsible-trigger.component.ts, sub/collapsible-content.component.ts
import { ref as buttonRef } from '../lib/button-ref.mjs';
const CHEVRON = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
const OWNS = 'cursor-pointer select-none outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 rounded-sm';
// Content is the consumer's, so both sides share it verbatim (inline styles, as the reference page has no consumer CSS either).
const LABEL = `<span style="font-size:.875rem;font-weight:500;display:inline-flex;align-items:center;gap:.5rem">Show more ${CHEVRON}</span>`;
const BODY = '<p style="margin:0;padding-top:.5rem;font-size:.875rem">Hidden until it is opened.</p>';

const state = (open) => (open ? 'open' : 'closed');
const ref = ({ open = false, owns = true }) =>
    `<ui-collapsible data-state="${state(open)}" data-slot="collapsible"><ui-collapsible-trigger class="contents"><span ${owns ? `class="${OWNS}" role="button" tabindex="0" aria-expanded="${open}"` : ''} data-state="${state(open)}" data-slot="collapsible-trigger">${owns ? LABEL : buttonRef('outline', 'default', 'Toggle')}</span></ui-collapsible-trigger><ui-collapsible-content class="contents">${open ? `<div class="overflow-hidden" data-state="open" data-slot="collapsible-content">${BODY}</div>` : ''}</ui-collapsible-content></ui-collapsible>`;
const el = ({ open = false, owns = true }) =>
    `<ge-collapsible${open ? ' open' : ''}><ge-collapsible-trigger>${owns ? LABEL : '<ge-button variant="outline">Toggle</ge-button>'}</ge-collapsible-trigger><ge-collapsible-content>${BODY}</ge-collapsible-content></ge-collapsible>`;

const items = [];
for (const [name, owns] of [['label', true], ['control', false]]) {
    for (const open of [false, true]) items.push({ id: `${name}-${state(open)}`, ref: ref({ open, owns }), el: el({ open, owns }) });
}
items.push({ id: 'label-focus', focus: { ref: 'span[role=button]', el: 'ge-collapsible-trigger' }, ref: ref({ owns: true }), el: el({ owns: true }) });
export default { name: 'collapsible', items };
