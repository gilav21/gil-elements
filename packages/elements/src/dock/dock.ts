import { html, nothing, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './dock.css?inline';
import type { GeDockItem } from './sub/dock-item.js';

export type DockPosition = 'bottom' | 'top' | 'left' | 'right';

/** One entry of the simple-mode `items`. */
export interface DockItemData {
    label?: string;
    icon?: string;
    /** Classes put on the rendered `ge-dock-item`, for your own stylesheet to hook. */
    class?: string;
    active?: boolean;
    /** Renders a link filling the item. */
    href?: string;
    /** Runs on activation. With no `href`, renders a button filling the item. */
    onClick?: () => void;
}

const BASE_WIDTH = 40;

/**
 * A macOS-style dock: a bar of icons that swell towards the pointer. Put `ge-dock-item`s inside it, or set `items`
 * and it builds them. The swell follows the pointer along the dock's axis (a vertical dock magnifies the item the
 * pointer is beside) and is mouse-only: on touch the dock stays at rest.
 *
 * @slot - `ge-dock-item`s. Once any is present, `items` is ignored.
 * @attr {number} magnification - Peak item width in px directly under the pointer; items rest at 40px.
 * @attr {number} distance - How far, in px, the pointer's influence reaches. The width falls off on a cosine curve from `magnification` to 40px at this distance.
 * @attr {'bottom' | 'top' | 'left' | 'right'} position - Where the dock is anchored: sets its alignment and axis (`left` and `right` stack a column).
 * @prop {DockItemData[]} items - Simple mode: one item per entry.
 * @csspart base - The bar.
 */
export class GeDock extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        magnification: { type: Number },
        distance: { type: Number },
        position: { reflect: true },
        items: { attribute: false },
        custom: { state: true },
        scrolls: { state: true },
    };

    declare magnification: number;
    declare distance: number;
    declare position: DockPosition;
    declare items: DockItemData[];
    declare custom: boolean;
    declare scrolls: boolean;

    private itemCenters: number[] = [];
    private pointer = Infinity;
    private frame: number | null = null;
    private resizeObserver?: ResizeObserver;

    constructor() {
        super();
        this.magnification = 60;
        this.distance = 100;
        this.position = 'bottom';
        this.items = [];
        this.custom = false;
        this.scrolls = false;
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        this.frame = null;
        this.resizeObserver?.disconnect();
        this.resizeObserver = undefined;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        if (this.hasUpdated) this.observeBar();
    }

    private get bar(): HTMLElement | null {
        return this.shadowRoot?.querySelector<HTMLElement>('.bar') ?? null;
    }

    /** A vertical dock scrolls only once its items are taller than the bar may grow; while it scrolls, scrollHeight > clientHeight holds exactly as long as it still overflows. */
    private measureScroll(): void {
        const bar = this.bar;
        this.scrolls = this.isVertical && !!bar && bar.scrollHeight > bar.clientHeight;
    }

    private observeBar(): void {
        const bar = this.bar;
        if (!bar || this.resizeObserver) return;
        this.resizeObserver = new ResizeObserver(() => this.measureScroll());
        this.resizeObserver.observe(bar);
        this.measureScroll();
    }

    private get isVertical(): boolean {
        return this.position === 'left' || this.position === 'right';
    }

    private allItems(): GeDockItem[] {
        const own = this.shadowRoot ? [...this.shadowRoot.querySelectorAll<GeDockItem>('ge-dock-item')] : [];
        return [...this.querySelectorAll<GeDockItem>('ge-dock-item'), ...own];
    }

    /** Caches each item's viewport centre along the dock's axis, the baseline the hover maths measures against. Call it after adding or removing items outside a pointer entry. */
    recalculateItemCenters(): void {
        const axis = this.isVertical ? 'y' : 'x';
        this.itemCenters = this.allItems().map((item) => item.getCenter(axis));
    }

    // A tap makes the browser replay it as mouseenter and mousemove and sends no mouseleave until the next tap elsewhere, which
    // would leave the tapped icon swollen. The pointer events that precede those mouse events say which kind of input it was.
    private touching = false;

    private readonly onPointer = (event: PointerEvent) => {
        const touch = event.pointerType === 'touch';
        if (touch && !this.touching) this.onLeave();
        this.touching = touch;
    };

    private readonly onEnter = () => {
        if (!this.touching) this.recalculateItemCenters();
    };

    private readonly onMove = (event: MouseEvent) => {
        if (this.touching) return;
        this.pointer = this.isVertical ? event.clientY : event.clientX;
        if (this.frame !== null) return;
        this.frame = requestAnimationFrame(() => {
            this.updateItems();
            this.frame = null;
        });
    };

    private readonly onLeave = () => {
        this.pointer = Infinity;
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        this.frame = null;
        this.updateItems();
    };

    /** Applies the width each item should have for the current pointer: a cosine falloff from `magnification` at the centre to 40px at `distance`, and 40px beyond. */
    updateItems(): void {
        this.allItems().forEach((item, index) => {
            const center = this.itemCenters[index];
            if (center === undefined) return;
            const offset = Math.abs(this.pointer - center);
            let width = BASE_WIDTH;
            if (this.pointer !== Infinity && offset < this.distance) {
                width = BASE_WIDTH + (this.magnification - BASE_WIDTH) * Math.cos((offset / this.distance) * (Math.PI / 2));
            }
            item.updateWidth(width);
        });
    }

    protected override firstUpdated(): void {
        this.recalculateItemCenters();
        this.observeBar();
    }

    protected override updated(changed: PropertyValues<GeDock>): void {
        if (changed.has('items') || changed.has('position') || changed.has('custom')) {
            this.recalculateItemCenters();
            // Items added to a column already at its max height leave the bar's own box the same size, so the observer stays quiet.
            this.measureScroll();
        }
        if (changed.has('position') || changed.has('custom') || changed.has('items')) this.stampLabels();
    }

    /** Tells every label which edge the dock sits on, so it opens on the side facing away from it. */
    private stampLabels(): void {
        const labels = [...this.querySelectorAll('ge-dock-label'), ...(this.shadowRoot?.querySelectorAll('ge-dock-label') ?? [])];
        for (const label of labels) label.setAttribute('position', this.position);
    }

    private readonly onSlotChange = (event: Event) => {
        const slot = event.target as HTMLSlotElement;
        this.custom = slot.assignedElements({ flatten: true }).some((el) => el.localName === 'ge-dock-item');
        this.stampLabels();
        this.measureScroll();
    };

    private simpleItem(item: DockItemData) {
        const activate = () => item.onClick?.();
        const name = item.label ?? nothing;
        let control: unknown = nothing;
        if (item.href) control = html`<a data-slot="dock-item-link" href=${item.href} aria-label=${name} @click=${activate}></a>`;
        else if (item.onClick) control = html`<button type="button" data-slot="dock-item-button" aria-label=${name} @click=${activate}></button>`;
        return html`<ge-dock-item class=${item.class ?? ''} ?active=${item.active ?? false}>
            ${item.label ? html`<ge-dock-label>${item.label}</ge-dock-label>` : nothing}
            ${item.icon ? html`<ge-dock-icon>${item.icon}</ge-dock-icon>` : nothing}
            ${control}
        </ge-dock-item>`;
    }

    protected override render() {
        return html`<div
            class="bar"
            part="base"
            data-slot="dock"
            data-position=${this.position}
            ?data-scrolls=${this.scrolls}
            tabindex="0"
            @pointerdown=${this.onPointer}
            @pointermove=${this.onPointer}
            @mouseenter=${this.onEnter}
            @mousemove=${this.onMove}
            @mouseleave=${this.onLeave}
        >
            <slot @slotchange=${this.onSlotChange}></slot>
            ${this.custom ? nothing : this.items.map((item) => this.simpleItem(item))}
        </div>`;
    }
}
