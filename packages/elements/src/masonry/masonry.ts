import { html, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './masonry.css?inline';

/** Column count per breakpoint, resolved against the masonry's own width (not the viewport). */
export interface MasonryColumns {
    base?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
}
export type MasonryColumnsInput = number | MasonryColumns;

const BREAKPOINTS: readonly (readonly [keyof MasonryColumns, number])[] = [
    ['xl', 1280],
    ['lg', 1024],
    ['md', 768],
    ['sm', 640],
    ['base', 0],
];
const DEFAULT_COLUMNS: MasonryColumns = { base: 1, sm: 2, lg: 3 };

const columnsFromAttribute = {
    fromAttribute(value: string | null): MasonryColumnsInput {
        if (value === null || value.trim() === '') return DEFAULT_COLUMNS;
        const count = Number(value);
        if (Number.isFinite(count)) return count;
        try {
            const parsed: unknown = JSON.parse(value);
            return parsed !== null && typeof parsed === 'object' ? (parsed as MasonryColumns) : DEFAULT_COLUMNS;
        } catch {
            return DEFAULT_COLUMNS;
        }
    },
};

function shortestColumn(bottoms: readonly number[]): number {
    let best = 0;
    for (let i = 1; i < bottoms.length; i++) if ((bottoms[i] ?? 0) < (bottoms[best] ?? 0)) best = i;
    return best;
}

/**
 * Column-balanced layout for items of uneven height. Unlike CSS `columns`, every item stays a direct child in source order
 * and is placed absolutely into the currently shortest column, so reading order, keyboard order and DOM order agree.
 * Layout is re-run (once per frame) when the box resizes, children are added or removed, or `columns` or `gap` change; call
 * `layout()` after a change neither can see, such as a font swap or an image decode.
 *
 * @attr {string} columns - A column count (`3`) or JSON per-breakpoint map (`{"base":1,"sm":2,"lg":4}`); as a property also an object. Breakpoints (`sm` 640, `md` 768, `lg` 1024, `xl` 1280) are container widths. Default `{ base: 1, sm: 2, lg: 3 }`.
 * @attr {number} gap - Gutter between columns and between stacked items in pixels (default 16).
 * @slot - The items.
 */
export class GeMasonry extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        columns: { converter: columnsFromAttribute },
        gap: { type: Number },
    };

    declare columns: MasonryColumnsInput;
    declare gap: number;
    private frame: number | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private mutationObserver: MutationObserver | null = null;

    constructor() {
        super();
        this.columns = DEFAULT_COLUMNS;
        this.gap = 16;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'masonry';
        this.startObserving();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.resizeObserver?.disconnect();
        this.mutationObserver?.disconnect();
        this.resizeObserver = null;
        this.mutationObserver = null;
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        this.frame = null;
    }

    private startObserving(): void {
        this.mutationObserver = new MutationObserver(() => this.scheduleLayout());
        this.mutationObserver.observe(this, { childList: true });
        if (typeof ResizeObserver === 'function') {
            this.resizeObserver = new ResizeObserver(() => this.scheduleLayout());
            this.resizeObserver.observe(this);
        }
        this.scheduleLayout();
    }

    protected override updated(changed: PropertyValues<this>): void {
        if (changed.has('columns') || changed.has('gap')) this.scheduleLayout();
    }

    private scheduleLayout(): void {
        if (this.frame !== null) return;
        this.frame = requestAnimationFrame(() => {
            this.frame = null;
            this.layout();
        });
    }

    /** Measures and positions every item now. Items are never re-created. */
    layout(): void {
        const items = [...this.children].filter((child): child is HTMLElement => child instanceof HTMLElement);
        if (items.length === 0) {
            this.style.height = '';
            return;
        }
        const gap = this.gap;
        const columnCount = this.columnCount(this.clientWidth);
        const columnWidth = (this.clientWidth - gap * (columnCount - 1)) / columnCount;

        // All widths are written before any height is read, so the browser lays out once, not once per item.
        for (const item of items) {
            item.style.position = 'absolute';
            item.style.width = `${columnWidth}px`;
        }
        const heights = items.map((item) => item.offsetHeight);

        const bottoms = new Array<number>(columnCount).fill(0);
        items.forEach((item, index) => {
            const column = shortestColumn(bottoms);
            const top = bottoms[column] ?? 0;
            item.style.top = `${top}px`;
            item.style.insetInlineStart = `${column * (columnWidth + gap)}px`;
            bottoms[column] = top + (heights[index] ?? 0) + gap;
        });
        this.style.height = `${Math.max(...bottoms) - gap}px`;
    }

    private columnCount(width: number): number {
        const requested = this.columns;
        if (typeof requested === 'number') return Math.max(1, Math.floor(requested));
        for (const [key, minWidth] of BREAKPOINTS) {
            const value = requested[key];
            if (value !== undefined && width >= minWidth) return Math.max(1, Math.floor(value));
        }
        return 1;
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
