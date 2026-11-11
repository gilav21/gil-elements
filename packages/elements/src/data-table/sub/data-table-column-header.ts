import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import '../../button/define.js';
import { chromeIcon, type ChromeIconName } from '../data-table-icons.js';
import { sortAriaLabel } from '../data-table-cells.js';
import { DATA_TABLE_LOCALES } from '../data-table.locales.js';
import type { SortDirection } from '../data-table.types.js';
import css from './data-table-column-header.css?inline';

export interface SortRequestDetail {
    /** The next direction in the cycle none, asc, desc, none. */
    direction: 'asc' | 'desc' | null;
    /** The activating click held shift: add to the sort chain instead of replacing it. */
    multi: boolean;
}

const ICON: Readonly<Record<string, ChromeIconName>> = { asc: 'arrow-up', desc: 'arrow-down' };

/**
 * The sort button of a data-table column header. It is controlled: a click only asks for the next direction, the
 * table answers by feeding `direction` back. The click is the only activation (Enter and Space already fire it), so one
 * key press sorts once. `aria-sort` belongs to the header cell around it, not to this element.
 *
 * @fires sort-request - On a click, with `{ direction, multi }`.
 * @attr {string} title - Text of the button, and the prefix of the default accessible name.
 * @attr {string} column - The column key; informational.
 * @attr {'asc' | 'desc'} direction - The current sort, drawn as the arrow.
 * @attr {boolean} enable-sorting - False draws the title as plain text. Defaults to true.
 * @attr {string} label - Accessible name of the button; without it, a sentence about the current state and the next action.
 * @csspart base - The wrapper.
 */
export class GeDataTableColumnHeader extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        title: {},
        column: {},
        direction: { reflect: true },
        enableSorting: { attribute: 'enable-sorting', converter: { fromAttribute: (value: string | null) => value !== 'false' } },
        sortIndex: { attribute: false },
        label: {},
        shortcuts: {},
    };

    declare title: string;
    declare column: string;
    declare direction: SortDirection;
    declare enableSorting: boolean;
    /** Zero-based position in a multi-sort chain; the badge shows `index + 1`. Null hides it. */
    declare sortIndex: number | null;
    declare label: string;
    /** `aria-keyshortcuts` of the button: the keys that move this column. */
    declare shortcuts: string;

    constructor() {
        super();
        this.title = '';
        this.column = '';
        this.direction = null;
        this.enableSorting = true;
        this.sortIndex = null;
        this.label = '';
        this.shortcuts = '';
    }

    private request(event: MouseEvent): void {
        const direction = this.direction === 'asc' ? 'desc' : this.direction === 'desc' ? null : 'asc';
        this.dispatchEvent(new CustomEvent<SortRequestDetail>('sort-request', { detail: { direction, multi: event.shiftKey }, bubbles: true }));
    }

    protected override render() {
        if (!this.enableSorting) return html`<div part="base" data-slot="data-table-column-header"><div>${this.title}</div></div>`;
        const label = this.label || sortAriaLabel(this.title, this.direction, this.sortIndex, DATA_TABLE_LOCALES.en);
        return html`<div part="base" data-slot="data-table-column-header">
            <ge-button variant="ghost" size="sm" aria-label=${label} aria-keyshortcuts=${this.shortcuts || nothing} @click=${this.request}>
                <span class="title">${this.title}</span>
                ${chromeIcon(ICON[this.direction ?? ''] ?? 'chevrons-up-down', 'sm', 'sort-icon')}
                ${this.sortIndex === null ? nothing : html`<span class="badge" aria-hidden="true">${this.sortIndex + 1}</span>`}
            </ge-button>
        </div>`;
    }
}
