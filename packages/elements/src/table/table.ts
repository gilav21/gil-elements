import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { adoptChildren } from '../shared/compound.js';
import css from './table.css?inline';

export const TABLE_REGISTER = 'ge-table-register';
export type TableRole = 'table' | 'grid' | 'treegrid';

/** What a cell or header cell needs from its table. */
export interface TableHost extends HTMLElement {
    readonly tableRole: TableRole;
    track(cell: HTMLElement & { requestUpdate(): void }): void;
    untrack(cell: HTMLElement): void;
}

/**
 * A table built from flex rows instead of native table elements: `ge-table-header`, `ge-table-body` and
 * `ge-table-footer` hold `ge-table-row`s of `ge-table-head` and `ge-table-cell`s, with an optional `ge-table-caption`.
 *
 * Columns do not align by themselves: give a head and the cells under it the same width (`flex: none; width: 100px`).
 *
 * The host's own `role` attribute is the table's ARIA role: `table` (the default), `grid` for an interactive table
 * (arrow-key navigation, selection, editing) or `treegrid` for one with expandable rows. Cells read it and take
 * `cell` or `gridcell` to match.
 */
export class GeTable extends UiElement implements TableHost {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    private readonly cells = new Set<HTMLElement & { requestUpdate(): void }>();
    private readonly roleObserver = new MutationObserver(() => {
        for (const cell of this.cells) cell.requestUpdate();
    });

    constructor() {
        super();
        adoptChildren<TableHost, HTMLElement>(this, TABLE_REGISTER, () => undefined);
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'table';
        if (!this.hasAttribute('role')) this.setAttribute('role', 'table');
        this.roleObserver.observe(this, { attributes: true, attributeFilter: ['role'] });
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.roleObserver.disconnect();
    }

    get tableRole(): TableRole {
        const role = this.getAttribute('role');
        return role === 'grid' || role === 'treegrid' ? role : 'table';
    }

    track(cell: HTMLElement & { requestUpdate(): void }): void {
        this.cells.add(cell);
    }

    untrack(cell: HTMLElement): void {
        this.cells.delete(cell as HTMLElement & { requestUpdate(): void });
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
