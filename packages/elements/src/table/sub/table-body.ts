import { css, html } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import '../../skeleton/define.js';
import './table-cell.js';
import './table-row.js';

/**
 * The body row group.
 *
 * @attr {boolean} skeleton - Replaces the rows with `skeleton-rows` single-cell placeholder rows while data loads; the header and footer stay put.
 * @attr {number} skeleton-rows - How many placeholder rows to show. Defaults to 5; match your page size so the table does not resize when the data lands.
 */
export class GeTableBody extends UiElement {
    static override styles = [
        UiElement.styles,
        css`
            :host {
                display: flex;
                flex-direction: column;
                flex: 1 1 0%;
            }
            ge-table-cell ge-skeleton {
                width: 100%;
                height: 1rem;
                border-radius: calc(var(--radius) - 2px);
            }
        `,
    ];
    static override properties = {
        skeleton: { type: Boolean, reflect: true },
        skeletonRows: { attribute: 'skeleton-rows', type: Number },
    };
    declare skeleton: boolean;
    declare skeletonRows: number;

    constructor() {
        super();
        this.skeleton = false;
        this.skeletonRows = 5;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'rowgroup');
        this.dataset.slot = 'table-body';
    }

    protected override render() {
        if (!this.skeleton) return html`<slot></slot>`;
        const rows = Array.from({ length: Math.max(0, Math.floor(this.skeletonRows)) }, (...[, i]) => i);
        return html`${rows.map(() => html`<ge-table-row><ge-table-cell><ge-skeleton></ge-skeleton></ge-table-cell></ge-table-row>`)}`;
    }
}
