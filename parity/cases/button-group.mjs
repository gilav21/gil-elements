// shadcn-angular button-group.component.ts, sub/*.ts; buttons as in cases/button.mjs
import { ref } from '../lib/button-ref.mjs';
const HOST = (cls) => `fieldset class="${cls} min-w-0"`;
const FOCUS = '[&>*]:focus-visible:z-10 [&>*]:focus-visible:relative [&>.contents>*]:focus-visible:z-10 [&>.contents>*]:focus-visible:relative';
const H = `flex w-fit items-stretch ${FOCUS} [&>*:not(:first-child)]:rounded-s-none [&>*:not(:first-child)]:border-s-0 [&>.contents:not(:first-child)>*]:rounded-s-none [&>.contents:not(:first-child)>*]:border-s-0 [&>*:not(:last-child)]:rounded-e-none [&>.contents:not(:last-child)>*]:rounded-e-none`;
const V = `flex w-fit items-stretch ${FOCUS} flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>.contents:not(:first-child)>*]:rounded-t-none [&>.contents:not(:first-child)>*]:border-t-0 [&>*:not(:last-child)]:rounded-b-none [&>.contents:not(:last-child)>*]:rounded-b-none`;
const outline = (label) => ref('outline', 'default', label);
const SEP = '<ui-button-group-separator class="contents"><div class="bg-border shrink-0 w-px self-stretch" role="separator" aria-orientation="vertical"></div></ui-button-group-separator>';
const TEXT = (t) => `<ui-button-group-text class="contents"><div class='bg-muted flex items-center gap-2 rounded-md border px-4 text-sm font-medium shadow-xs [&_svg]:pointer-events-none [&_svg:not([class*="size-"])]:size-4'>${t}</div></ui-button-group-text>`;
const group = (cls, inner) => `<${HOST(cls)}>${inner}</fieldset>`;
const three = ['Years', 'Months', 'Days'];
export default {
    name: 'button-group',
    items: [
        { id: 'horizontal', ref: group(H, three.map((l) => outline(l)).join('')), el: `<ge-button-group>${three.map((l) => `<ge-button variant="outline">${l}</ge-button>`).join('')}</ge-button-group>` },
        { id: 'vertical', ref: group(V, three.map((l) => outline(l)).join('')), el: `<ge-button-group orientation="vertical">${three.map((l) => `<ge-button variant="outline">${l}</ge-button>`).join('')}</ge-button-group>` },
        { id: 'text-and-separator', ref: group(H, `${TEXT('USD')}${outline('Pay')}${SEP}${outline('Cancel')}`), el: '<ge-button-group><ge-button-group-text>USD</ge-button-group-text><ge-button variant="outline">Pay</ge-button><ge-button-group-separator></ge-button-group-separator><ge-button variant="outline">Cancel</ge-button></ge-button-group>' },
    ],
};
