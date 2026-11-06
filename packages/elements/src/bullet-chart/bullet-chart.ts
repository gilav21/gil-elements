import { html, nothing, svg, unsafeCSS } from 'lit';
import { GeChartBase } from '../shared/chart/chart-base.js';
import { extent, formatChartValue } from '../shared/chart/chart.utils.js';
import { linearScale } from '../shared/chart/chart-scale.js';
import css from './bullet-chart.css?inline';

const PAD = 4;

/**
 * One measure against a target and qualitative ranges, in a single thin row. The ranges are upper bounds, drawn as
 * shaded bands that get darker as they rise; the measure is the bar down the middle and the target a vertical mark.
 *
 * @attr {number} value - The measure.
 * @attr {number} target - The target mark. Omit it for none.
 * @attr {number} min - The value at the left end. Defaults to 0.
 * @attr {string} color - Fill of the measure. Defaults to the primary colour.
 * @attr {string} label - Names the value for assistive tech.
 * @attr {string} unit - Put after the value in the accessible summary, as in `%`.
 * @prop {number[]} ranges - Upper bounds of the bands, in any order.
 * @csspart base - The container.
 */
export class GeBulletChart extends GeChartBase {
    static override styles = [GeChartBase.styles, unsafeCSS(css)];
    static override properties = {
        ...GeChartBase.properties,
        value: { type: Number },
        target: { type: Number },
        ranges: { attribute: false },
        min: { type: Number },
        color: {},
        label: {},
        unit: {},
    };

    declare value: number;
    declare target: number | undefined;
    declare ranges: number[];
    declare min: number;
    declare color: string;
    declare label: string;
    declare unit: string;

    constructor() {
        super();
        this.value = 0;
        this.target = undefined;
        this.ranges = [];
        this.min = 0;
        this.color = '';
        this.label = '';
        this.unit = '';
        this.width = 360;
        this.height = 40;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'bullet-chart-host';
    }

    private get scale() {
        const track = Math.max(0, this.svgWidth - PAD * 2);
        const max = extent([this.value, this.target ?? 0, ...this.ranges, this.min + 1])?.[1] ?? this.min + 1;
        return { track, ...linearScale([this.min, max], [0, track]) };
    }

    private bands(scale: ReturnType<typeof linearScale>) {
        const sorted = [...this.ranges].sort((a, b) => a - b);
        let previous = this.min;
        return sorted.map((bound, i) => {
            const x = scale.scale(previous);
            const width = Math.max(0, scale.scale(bound) - x);
            previous = bound;
            return { x, width, opacity: 0.12 + (i / Math.max(1, sorted.length)) * 0.2 };
        });
    }

    private get summary(): string {
        const name = this.heading ? `${this.heading}. ` : '';
        const caption = this.label ? `${this.label}: ` : '';
        const target = this.target === undefined ? '' : ` (target ${formatChartValue(this.target)}${this.unit})`;
        return `${name}Bullet chart. ${caption}${formatChartValue(this.value)}${this.unit}${target}.`;
    }

    protected override render() {
        const scale = this.scale;
        const h = this.height;
        const measureHeight = h / 3;
        const measureWidth = Math.min(scale.track, Math.max(0, scale.scale(this.value)));
        const targetX = this.target === undefined ? null : scale.scale(this.target);
        return html`<div part="base" class="base" data-slot="bullet-chart" role="img" aria-label=${this.summary}>
            <svg viewBox=${`0 0 ${this.svgWidth} ${h}`} width="100%" height=${h}>
                <g transform="translate(4, 0)">
                    ${this.bands(scale).map((b) => svg`<rect class="range" data-slot="bullet-range" x=${b.x} y="0" width=${b.width} height=${h} rx="2" fill-opacity=${b.opacity} />`)}
                    <rect class="measure" data-slot="bullet-measure" x="0" y=${h / 2 - measureHeight / 2} width=${measureWidth} height=${measureHeight} rx="2" fill=${this.color || 'var(--primary)'} />
                    ${targetX === null ? nothing : svg`<line class="target" data-slot="bullet-target" x1=${targetX} x2=${targetX} y1=${h * 0.18} y2=${h * 0.82} stroke-width="3" />`}
                </g>
            </svg>
        </div>`;
    }
}
