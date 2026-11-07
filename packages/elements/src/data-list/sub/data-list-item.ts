import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { DATA_LIST_REGISTER, type DataListHost, type DataListRow } from '../data-list.js';
import css from './data-list-item.css?inline';

let counter = 0;

/**
 * One row of a `ge-data-list`: `label` is the term and the content is its value. The list draws the `<dt>` and
 * `<dd>` itself, so this element never sits between them and the `<dl>`.
 *
 * @slot - The value.
 * @attr {string} label - The term, shown in the row's `<dt>`.
 */
export class GeDataListItem extends UiElement implements DataListRow {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = { label: {} };

    declare label: string;
    readonly slotName = `row-${++counter}`;
    private list?: DataListHost;

    constructor() {
        super();
        this.label = '';
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'data-list-item';
        this.slot = this.slotName;
        this.list = findParent<DataListHost, GeDataListItem>(this, DATA_LIST_REGISTER);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.list?.unregister(this);
        this.list = undefined;
    }

    protected override updated(): void {
        this.list?.refresh();
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
