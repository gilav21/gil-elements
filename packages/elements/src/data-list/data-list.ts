import { html, unsafeCSS } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { UiElement } from '@gilav21/elements-base';
import { adoptChildren, byDocumentOrder } from '../shared/compound.js';
import css from './data-list.css?inline';

export const DATA_LIST_REGISTER = 'ge-data-list-register';

export type DataListOrientation = 'vertical' | 'horizontal';

/** A row of a data-driven list. Both texts are shown as given. */
export interface DataListEntry {
    label: string;
    value: string;
}

/** What a `ge-data-list-item` is to its list. */
export interface DataListRow extends HTMLElement {
    /** The text of the row's `<dt>`. */
    readonly label: string;
    /** The slot its value is shown through, unique within the list. */
    readonly slotName: string;
}

export interface DataListHost extends HTMLElement {
    register(row: DataListRow): void;
    unregister(row: DataListRow): void;
    refresh(): void;
}

/**
 * Label and value pairs as a real description list: a `<dl>` whose children are `<dt>` and `<dd>`.
 *
 * Simple mode: set `items` (a property, an array of `{ label, value }`). Custom mode: write
 * `ge-data-list-item label="…"` children whose content is the value, so a value can be a badge, a link or
 * anything else. Both can be used together; data rows come first.
 *
 * @slot - `ge-data-list-item` rows.
 * @attr {'vertical' | 'horizontal'} orientation - `vertical` stacks each value under its label. `horizontal` puts
 * labels in a column beside the values from 640px up and stacks them below that.
 * @csspart list - The `<dl>`.
 * @csspart label - A `<dt>`.
 * @csspart value - A `<dd>`.
 */
export class GeDataList extends UiElement implements DataListHost {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        items: { attribute: false },
        orientation: { reflect: true },
    };

    declare items: readonly DataListEntry[];
    declare orientation: DataListOrientation;
    private readonly rows = new Set<DataListRow>();

    constructor() {
        super();
        this.items = [];
        this.orientation = 'vertical';
        adoptChildren<DataListHost, DataListRow>(this, DATA_LIST_REGISTER, (row) => this.register(row));
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'data-list';
    }

    register(row: DataListRow): void {
        this.rows.add(row);
        this.requestUpdate();
    }

    unregister(row: DataListRow): void {
        this.rows.delete(row);
        this.requestUpdate();
    }

    /** Re-renders after a row changed its label. */
    refresh(): void {
        this.requestUpdate();
    }

    protected override render() {
        const rows = [...this.rows].sort(byDocumentOrder);
        return html`<dl class="list" part="list" data-slot="data-list-content">
            ${this.items.map((item) => html`<dt part="label" data-slot="data-list-label">${item.label}</dt><dd part="value" data-slot="data-list-value">${item.value}</dd>`)}
            ${repeat(rows, (row) => row.slotName, (row) => html`<dt part="label" data-slot="data-list-label">${row.label}</dt><dd part="value" data-slot="data-list-value"><slot name=${row.slotName}></slot></dd>`)}
        </dl>`;
    }
}
