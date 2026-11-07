import { css, html } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { TABLE_REGISTER, type TableHost } from '../table.js';

/** Padding and checkbox rules shared by `ge-table-head` and `ge-table-cell`. */
export const CELL_STYLES = css`
    :host {
        --_d: var(--density-table, var(--density, 1));
        display: flex;
        align-items: center;
        flex: 1 1 0%;
        flex-shrink: 0;
    }
    :host([data-has-checkbox]:dir(ltr)) {
        padding-right: 0;
    }
    :host([data-has-checkbox]:dir(rtl)) {
        padding-left: 0;
    }
    ::slotted([role='checkbox']) {
        translate: 0 2px;
    }
`;

/** Marks itself when an element with `role="checkbox"` sits inside, since `:host(:has())` matches nothing. */
export abstract class GeTableCellBase extends UiElement {
    protected table?: TableHost;

    override connectedCallback(): void {
        super.connectedCallback();
        this.table = findParent<TableHost, GeTableCellBase>(this, TABLE_REGISTER);
        this.table?.track(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.table?.untrack(this);
    }

    protected syncCheckbox = () => {
        this.toggleAttribute('data-has-checkbox', this.querySelector('[role="checkbox"]') !== null);
    };

    protected override render() {
        return html`<slot @slotchange=${this.syncCheckbox}></slot>`;
    }
}
