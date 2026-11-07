import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './chart-tooltip.css?inline';

/** One line of a chart tooltip; `value` is already formatted. */
export interface ChartTooltipRow {
    label: string;
    value: string;
    color?: string;
}

/**
 * The tooltip a chart shows over a point. It is positioned against the nearest positioned ancestor, normally the
 * chart's own wrapper, at `x` and `y` pixels from its corner.
 *
 * @attr {boolean} visible - Whether it shows. Hidden means not rendered, so no stale content lingers.
 * @attr {number} x - Pixels from the left of the positioned ancestor.
 * @attr {number} y - Pixels from the top of the positioned ancestor.
 * @attr {string} heading - A line above the rows, typically the hovered category.
 * @attr {boolean} flip-x - Sits left of the anchor, for a point near the right edge.
 * @attr {boolean} flip-y - Sits above the anchor, for a point near the bottom edge.
 * @prop {ChartTooltipRow[]} rows - The lines; a row with a `color` gets a swatch.
 * @csspart base - The tooltip surface.
 */
export class GeChartTooltip extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        visible: { type: Boolean, reflect: true },
        x: { type: Number },
        y: { type: Number },
        heading: {},
        rows: { attribute: false },
        flipX: { type: Boolean, attribute: 'flip-x' },
        flipY: { type: Boolean, attribute: 'flip-y' },
    };

    declare visible: boolean;
    declare x: number;
    declare y: number;
    declare heading: string | undefined;
    declare rows: ChartTooltipRow[];
    declare flipX: boolean;
    declare flipY: boolean;

    constructor() {
        super();
        this.visible = false;
        this.x = 0;
        this.y = 0;
        this.rows = [];
        this.flipX = false;
        this.flipY = false;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'chart-tooltip-host';
    }

    protected override render() {
        if (!this.visible) return nothing;
        const flip = this.flipX || this.flipY ? `;translate:${this.flipX ? '-100%' : '0'} ${this.flipY ? '-100%' : '0'}` : '';
        return html`<div part="base" class="base" data-slot="chart-tooltip" role="tooltip" style=${`left:${this.x}px;top:${this.y}px${flip}`}>
            ${this.heading ? html`<div class="heading">${this.heading}</div>` : nothing}
            ${this.rows.map(
                (row) => html`<div class="row">
                    ${row.color ? html`<span class="dot" style="background:${row.color}"></span>` : nothing}
                    <span class="label">${row.label}</span>
                    <span class="value">${row.value}</span>
                </div>`,
            )}
        </div>`;
    }
}
