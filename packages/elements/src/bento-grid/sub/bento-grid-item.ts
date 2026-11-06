import { html, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './bento-grid-item.css?inline';

/**
 * A static card for a `ge-bento-grid`. It is a grid item itself, so it spans cells by CSS. This one is not dragged or resized:
 * the grid edits only the widgets in its `items`.
 *
 * @attr {number} span - Grid columns the card spans (default 1).
 * @attr {number} row-span - Grid rows the card spans (default 1).
 * @slot - The card's content.
 */
export class GeBentoGridItem extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        span: { type: Number },
        rowSpan: { attribute: 'row-span', type: Number },
    };

    declare span: number;
    declare rowSpan: number;

    constructor() {
        super();
        this.span = 1;
        this.rowSpan = 1;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'bento-grid-item';
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (changed.has('span')) this.style.gridColumn = `span ${this.span}`;
        if (changed.has('rowSpan')) this.style.gridRow = `span ${this.rowSpan}`;
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
