import { html, nothing, svg, unsafeCSS } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { GeChartBase } from '../shared/chart/chart-base.js';
import type { ChartDataPoint } from '../shared/chart/chart.types.js';
import { extent, formatChartValue, getChartColor, getChartSummary } from '../shared/chart/chart.utils.js';
import { linearScale } from '../shared/chart/chart-scale.js';
import { resolveBarRaceLocale, type BarRaceChartLocale } from './bar-race-chart.locales.js';
import css from './bar-race-chart.css?inline';

interface RaceBar {
    name: string;
    value: number;
    color: string;
    x: number;
    y: number;
    width: number;
    labelX: number;
    labelAnchor: 'start' | 'end';
}

/** Room, in px, a negative bar's value label needs between the bar end and the name labels at the start edge. */
const LABEL_ROOM = 64;
const PAD_Y = 10;

/** A frame's points, one per name (the last entry for a name wins), highest value first. */
const rankFrame = (frame: ChartDataPoint[]): ChartDataPoint[] =>
    [...new Map(frame.map((point) => [point.name, point])).values()].sort((a, b) => b.value - a.value);

/**
 * A race between named values over time: each frame is ranked and cut to `max-bars`, and bars slide to their new rank and
 * length as the frame changes. Names are the identity across frames, so reusing them is what makes bars move instead of
 * pop. The value axis is rescaled per frame, so lengths compare within a frame, not across the race.
 *
 * @fires frame-change - The shown frame changed; `detail` is the frame index. `goToFrame` fires it even for the frame already shown.
 * @fires animation-complete - Playback ran off the last frame and stopped. Never fires while `loop` is on, nor from `pause`.
 * @attr {number} animation-duration - Milliseconds a frame is held in playback, and the length of the bar transition. Defaults to 500.
 * @attr {boolean} auto-play - Start playing once there is a frame to show, just once.
 * @attr {boolean} loop - Return to the first frame after the last instead of stopping.
 * @attr {number} max-bars - The top N bars of each frame. Also splits the plot height, so a higher number thins every bar. Defaults to 10.
 * @attr {number} bar-radius - Corner radius of a bar in px. Defaults to 4.
 * @attr {number} bar-gap - Gap between bars in px. Defaults to 4.
 * @attr {string} locale - Locale id for the control labels; follows the page's `lang` when unset.
 * @prop {ChartDataPoint[][]} frames - One entry per time step, each `{ name, value, color? }[]`.
 * @prop {string[]} frameLabels - A caption per frame (else `Frame N`); the first and last also sit under the slider.
 * @prop {BarRaceChartLocale} locale - May also be a dictionary object.
 * @csspart base - The chart container.
 */
export class GeBarRaceChart extends GeChartBase {
    static override readonly styles = [GeChartBase.styles, unsafeCSS(css)];
    static override readonly properties = {
        ...GeChartBase.properties,
        frames: { attribute: false },
        frameLabels: { attribute: false },
        animationDuration: { type: Number, attribute: 'animation-duration' },
        autoPlay: { type: Boolean, attribute: 'auto-play' },
        loop: { type: Boolean },
        maxBars: { type: Number, attribute: 'max-bars' },
        barRadius: { type: Number, attribute: 'bar-radius' },
        barGap: { type: Number, attribute: 'bar-gap' },
        locale: {},
        frameIndex: { state: true },
        playing: { state: true },
    };

    declare frames: ChartDataPoint[][];
    declare frameLabels: string[];
    declare animationDuration: number;
    declare autoPlay: boolean;
    declare loop: boolean;
    declare maxBars: number;
    declare barRadius: number;
    declare barGap: number;
    declare locale: string | BarRaceChartLocale | null;
    /** The index of the frame shown. */
    declare frameIndex: number;
    /** Whether playback is running. */
    declare playing: boolean;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private autoStarted = false;

    constructor() {
        super();
        this.frames = [];
        this.frameLabels = [];
        this.animationDuration = 500;
        this.autoPlay = false;
        this.loop = false;
        this.maxBars = 10;
        this.barRadius = 4;
        this.barGap = 4;
        this.locale = null;
        this.frameIndex = 0;
        this.playing = false;
        this.width = 600;
        this.height = 400;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'bar-race-chart-host';
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.stopTimer();
    }

    /** Frames arrive as a property after the element is upgraded, so auto-play waits for the first frame to exist. */
    protected override updated(): void {
        if (!this.autoPlay || this.autoStarted || this.frames.length === 0) return;
        this.autoStarted = true;
        this.play();
    }

    /** Starts from the current frame: the next one shows at once, then each step waits `animationDuration`. Does nothing while playing. */
    play(): void {
        if (this.playing) return;
        this.playing = true;
        this.step();
    }

    /** Stops on the current frame without firing `animation-complete`; `play` resumes from here. */
    pause(): void {
        this.playing = false;
        this.stopTimer();
    }

    togglePlay(): void {
        if (this.playing) this.pause();
        else this.play();
    }

    /** Stops and returns to the first frame; the bars animate back. Follow with `play` to replay. */
    reset(): void {
        this.pause();
        this.frameIndex = 0;
        this.emit('frame-change', 0);
    }

    /** Jumps to a frame, clamped into range, and fires `frame-change`. Playback is left alone. */
    goToFrame(index: number): void {
        const valid = Math.max(0, Math.min(this.frames.length - 1, index));
        this.frameIndex = valid;
        this.emit('frame-change', valid);
    }

    private step(): void {
        if (!this.playing) return;
        const last = this.frameIndex >= this.frames.length - 1;
        if (last && !this.loop) {
            this.playing = false;
            this.emit('animation-complete', undefined);
            return;
        }
        const next = last ? 0 : this.frameIndex + 1;
        this.frameIndex = next;
        this.emit('frame-change', next);
        this.timer = setTimeout(() => this.step(), this.animationDuration);
    }

    private stopTimer(): void {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
    }

    private readonly onSlide = (event: Event) => {
        this.pause();
        this.goToFrame(Number.parseInt((event.target as HTMLInputElement).value, 10));
    };

    private get frame(): ChartDataPoint[] {
        return this.frames[this.frameIndex] ?? [];
    }

    private get frameLabel(): string {
        return this.frameLabels[this.frameIndex] ?? `Frame ${this.frameIndex + 1}`;
    }

    /** Palette colour per name, in first-appearance order over all frames (each in rank order), or the point's own `color`. */
    private get colors(): Map<string, string> {
        const colors = new Map<string, string>();
        for (const frame of this.frames) {
            for (const point of rankFrame(frame)) {
                if (!colors.has(point.name)) colors.set(point.name, getChartColor(colors.size, point.color));
            }
        }
        return colors;
    }

    private get area() {
        const rtl = this.rtl;
        const left = rtl ? 80 : 120;
        const right = this.svgWidth - (rtl ? 120 : 80);
        return { left, right, top: PAD_Y, bottom: this.height - PAD_Y, height: this.height - PAD_Y * 2 };
    }

    private get barHeight(): number {
        return (this.area.height - (this.maxBars - 1) * this.barGap) / this.maxBars;
    }

    private bars(): RaceBar[] {
        const frame = this.frame;
        if (frame.length === 0) return [];
        const a = this.area;
        const rtl = this.rtl;
        const values = extent(frame.map((d) => d.value));
        const scale = linearScale([Math.min(0, values?.[0] ?? 0) * 1.1, Math.max(0, values?.[1] ?? 0) * 1.1], rtl ? [a.right, a.left] : [a.left, a.right]);
        const baseline = scale.scale(0);
        const colors = this.colors;
        const startEdge = rtl ? a.right : a.left;
        return rankFrame(frame).slice(0, this.maxBars).map((point, rank) => {
            const end = scale.scale(point.value);
            const width = Math.abs(end - baseline);
            const x = Math.min(baseline, end);
            // Positive values grow away from the start edge, negative ones toward it.
            const growsRight = (point.value >= 0) !== rtl;
            const freeEnd = growsRight ? x + width : x;
            // A negative label runs toward the name labels, so with no room before them it moves inside the bar end.
            const outside = point.value >= 0 || Math.abs(freeEnd - startEdge) >= LABEL_ROOM;
            const labelOutside = growsRight === outside;
            return {
                name: point.name,
                value: point.value,
                color: colors.get(point.name) ?? getChartColor(rank, point.color),
                x,
                y: a.top + rank * (this.barHeight + this.barGap),
                width,
                labelX: labelOutside ? freeEnd + 12 : freeEnd - 12,
                labelAnchor: labelOutside ? 'start' : 'end',
            };
        });
    }

    private plot() {
        const a = this.area;
        const rtl = this.rtl;
        const h = this.barHeight;
        const ms = `transition-duration:${this.animationDuration}ms`;
        return svg`${repeat(
            this.bars(),
            (b) => b.name,
            (b) => svg`<g data-slot="race-bar">
                <rect class="bar" x=${b.x} y=${b.y} width=${b.width} height=${h} rx=${this.barRadius} fill=${b.color} style=${ms} />
                <text class="name" x=${rtl ? a.right + 12 : a.left - 12} y=${b.y + h / 2} text-anchor=${rtl ? 'start' : 'end'} dominant-baseline="middle" style=${ms}>${b.name}</text>
                <text class="value" x=${b.labelX} y=${b.y + h / 2} text-anchor=${b.labelAnchor} dominant-baseline="middle" style=${ms}>${formatChartValue(b.value, { compact: true })}</text>
            </g>`,
        )}`;
    }

    private icon() {
        return this.playing
            ? html`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>`
            : html`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>`;
    }

    protected override render() {
        const t = resolveBarRaceLocale(this.locale);
        const labels = this.frameLabels;
        return html`<div part="base" class="base" data-slot="bar-race-chart" dir=${t.rtl ? 'rtl' : nothing}>
            <div class="header">
                <div class="caption">${this.frameLabel}</div>
                <div class="controls">
                    <button type="button" class="control" data-slot="race-play" aria-label=${this.playing ? t.pause : t.play} @click=${() => this.togglePlay()}>${this.icon()}</button>
                    <button type="button" class="control" data-slot="race-reset" aria-label=${t.reset} @click=${() => this.reset()}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                    </button>
                </div>
            </div>
            <svg
                viewBox=${`0 0 ${this.svgWidth} ${this.height}`}
                width="100%"
                height="auto"
                style=${`max-width:${this.svgWidth}px;aspect-ratio:${this.svgWidth} / ${this.height}`}
                role="img"
                aria-label=${getChartSummary('Bar race chart', this.frame.length, this.heading)}
            >
                <g>${this.plot()}</g>
            </svg>
            <div class="timeline">
                <div class="slider-row">
                    <input type="range" class="slider" data-slot="race-slider" min="0" max=${this.frames.length - 1} .value=${String(this.frameIndex)} aria-label=${t.timeline} aria-valuetext=${this.frameLabel} @input=${this.onSlide} />
                </div>
                <div class="ends">${labels.length > 0 ? html`<span>${labels[0]}</span><span>${labels.at(-1)}</span>` : nothing}</div>
            </div>
        </div>`;
    }
}
