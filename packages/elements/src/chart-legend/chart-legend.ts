import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import type { LegendPosition } from '../shared/chart/chart.types.js';
import css from './chart-legend.css?inline';

/** One entry of a legend. */
export interface ChartLegendItem {
    key: string;
    label: string;
    color: string;
}

/**
 * The key of a chart. Presentational: the chart owns the set of hidden series and updates `hiddenKeys` when `item-toggle`
 * fires. An entry is a button for the keyboard and for touch, not just the mouse.
 *
 * @fires item-toggle - When an entry is activated; `detail` is its `key`. Only while `interactive`.
 * @attr {string} position - `top`, `bottom` (default), `left` or `right`. The sides stack the entries in a column.
 * @attr {boolean} interactive - Whether entries can be activated. On by default; `interactive="false"` makes a read-only key.
 * @prop {ChartLegendItem[]} items - The entries, in order.
 * @prop {string[]} hiddenKeys - Keys of the hidden series, shown dimmed and struck through.
 * @csspart base - The wrapper.
 */
export class GeChartLegend extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        items: { attribute: false },
        hiddenKeys: { attribute: false },
        position: { reflect: true },
        interactive: {
            reflect: true,
            converter: { fromAttribute: (value: string | null) => value !== 'false', toAttribute: (value: boolean) => (value ? '' : 'false') },
        },
    };

    declare items: ChartLegendItem[];
    declare hiddenKeys: string[];
    declare position: LegendPosition;
    declare interactive: boolean;

    constructor() {
        super();
        this.items = [];
        this.hiddenKeys = [];
        this.position = 'bottom';
        this.interactive = true;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'chart-legend';
    }

    private activate(key: string): void {
        if (!this.interactive) return;
        this.dispatchEvent(new CustomEvent<string>('item-toggle', { detail: key, bubbles: true, composed: true }));
    }

    private onKeydown(event: KeyboardEvent, key: string): void {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        this.activate(key);
    }

    protected override render() {
        const interactive = this.interactive;
        return html`<div part="base" class="base" data-slot="chart-legend">
            ${this.items.map((item) => {
                const hidden = this.hiddenKeys.includes(item.key);
                return html`<span
                    class="item"
                    data-slot="chart-legend-item"
                    ?data-hidden=${hidden}
                    role=${interactive ? 'button' : nothing}
                    tabindex=${interactive ? '0' : nothing}
                    aria-pressed=${interactive ? String(!hidden) : nothing}
                    aria-label=${item.label}
                    @click=${() => this.activate(item.key)}
                    @keydown=${(event: KeyboardEvent) => this.onKeydown(event, item.key)}
                    ><span class="swatch" style="background:${item.color}"></span><span class="label">${item.label}</span></span
                >`;
            })}
        </div>`;
    }
}
