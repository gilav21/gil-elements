import { css } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { CELL_STYLES, GeTableCellBase } from './table-cell-base.js';

/**
 * A body or footer cell. All cells share the row's width evenly; to size a column, set `flex: none` and a width here
 * and on the matching `ge-table-head`. Its role is `cell` in a table and `gridcell` in a `grid` or `treegrid`.
 */
export class GeTableCell extends GeTableCellBase {
    static override readonly styles = [
        UiElement.styles,
        CELL_STYLES,
        css`
            :host {
                padding: calc(0.5rem * var(--_d));
            }
        `,
    ];

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'table-cell';
    }

    protected override updated(): void {
        this.setAttribute('role', this.table && this.table.tableRole !== 'table' ? 'gridcell' : 'cell');
    }
}
