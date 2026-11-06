import { UiElement } from '@gilav21/elements-base';
import type { ChartDirection } from './chart.types.js';
import { isRtl } from '../menu.js';

/** An attribute that is on unless it is written `="false"`: `show-tooltip="false"`. */
export const defaultTrue = { fromAttribute: (value: string | null) => value !== 'false', toAttribute: (value: boolean) => (value ? null : 'false') };

/**
 * What every chart shares: the width it measures from its own box (the `viewBox` tracks it, so user space is CSS px
 * and nothing stretches), the layout direction, the series the legend has hidden, and the hovered index.
 *
 * @attr {number} width - The width used until the element has been measured.
 * @attr {number} height - Height in px, applied literally.
 * @attr {string} heading - A name for the chart, put before its accessible summary.
 * @attr {string} dir - `auto` (default) follows the inherited direction; `ltr` or `rtl` forces it.
 */
export abstract class GeChartBase extends UiElement {
    static override properties = {
        width: { type: Number },
        height: { type: Number },
        heading: {},
        chartDir: { attribute: 'dir' },
        measuredWidth: { state: true },
        domRtl: { state: true },
        hiddenKeys: { state: true },
        hoverIndex: { state: true },
    };

    declare width: number;
    declare height: number;
    declare heading: string | undefined;
    declare chartDir: ChartDirection;
    declare measuredWidth: number | null;
    declare domRtl: boolean;
    /** Keys of the series the legend has hidden. */
    declare hiddenKeys: string[];
    declare hoverIndex: number | null;
    private observer?: ResizeObserver;

    constructor() {
        super();
        this.width = 500;
        this.height = 300;
        this.chartDir = 'auto';
        this.measuredWidth = null;
        this.domRtl = false;
        this.hiddenKeys = [];
        this.hoverIndex = null;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.measuredWidth = this.clientWidth || null;
        this.domRtl = isRtl(this);
        this.observer = new ResizeObserver((entries) => {
            const measured = Math.round(entries[0]?.contentRect.width ?? this.clientWidth);
            if (measured > 0) this.measuredWidth = measured;
        });
        this.observer.observe(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.observer?.disconnect();
    }

    protected get svgWidth(): number {
        return this.measuredWidth ?? this.width;
    }

    protected get rtl(): boolean {
        if (this.chartDir === 'rtl') return true;
        if (this.chartDir === 'ltr') return false;
        return this.domRtl;
    }

    /** Hides or shows one series, by the key the legend reported. */
    toggleSeries(key: string): void {
        this.hiddenKeys = this.hiddenKeys.includes(key) ? this.hiddenKeys.filter((k) => k !== key) : [...this.hiddenKeys, key];
    }

    protected emit<T>(name: string, detail: T): void {
        this.dispatchEvent(new CustomEvent<T>(name, { detail, bubbles: true, composed: true }));
    }
}
