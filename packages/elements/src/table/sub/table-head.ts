import { css } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { CELL_STYLES, GeTableCellBase } from './table-cell-base.js';

/**
 * A column header. Give it the same width as the cells beneath it. Its role is `columnheader`; set
 * `role="presentation"` on a purely decorative filler cell.
 */
export class GeTableHead extends GeTableCellBase {
    static override readonly styles = [
        UiElement.styles,
        CELL_STYLES,
        css`
            :host {
                height: calc(2.5rem * var(--_d));
                padding-inline: calc(0.5rem * var(--_d));
                color: var(--foreground);
                text-align: start;
                font-weight: 500;
            }
        `,
    ];

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'table-head';
        if (!this.hasAttribute('role')) this.setAttribute('role', 'columnheader');
    }
}
