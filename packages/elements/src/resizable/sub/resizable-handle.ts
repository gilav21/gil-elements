import { html, nothing, svg, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { GeResizablePanel } from './resizable-panel.js';
import type { GeResizablePanelGroup, ResizableDirection } from '../resizable.js';
import css from './resizable-handle.css?inline';

const KEYBOARD_STEP = 5;

const DOTS = svg`<svg class="dots" viewBox="0 0 6 10" fill="currentColor" aria-hidden="true"><circle cx="1" cy="2" r="0.8" /><circle cx="1" cy="5" r="0.8" /><circle cx="1" cy="8" r="0.8" /><circle cx="5" cy="2" r="0.8" /><circle cx="5" cy="5" r="0.8" /><circle cx="5" cy="8" r="0.8" /></svg>`;

interface Pair {
    before: GeResizablePanel;
    after: GeResizablePanel;
}

/**
 * The divider between two panels. Drag it (mouse or one finger) or use the arrow keys along the group's axis to
 * move the boundary; each panel stays within its own `min-size` and `max-size`.
 *
 * @fires resized - While the boundary moves; `detail` is `{ delta, sizes }`: the pixel offset from where the drag
 *   started (`0` for a key press) and the two panels' new percentages. The panels already have the new sizes.
 * @attr {boolean} with-handle - Draw the dotted grip in the middle of the divider.
 * @attr {number} handle-size - Thickness of the divider in px, along the group's axis; also its hit area. Defaults to `4`.
 * @attr {boolean} disabled - Remove the divider, freezing the panels where they are.
 * @attr {string} aria-label - Accessible name of the separator. Defaults to "Resize Handle".
 */
export class GeResizableHandle extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        withHandle: { type: Boolean, attribute: 'with-handle' },
        handleSize: { type: Number, attribute: 'handle-size' },
        disabled: { type: Boolean, reflect: true },
        ariaLabel: { attribute: 'aria-label' },
        dragging: { state: true },
    };
    declare withHandle: boolean;
    declare handleSize: number;
    declare disabled: boolean;
    declare ariaLabel: string | null;
    declare dragging: boolean;

    private cleanup: (() => void)[] = [];

    constructor() {
        super();
        this.withHandle = false;
        this.handleSize = 4;
        this.disabled = false;
        this.ariaLabel = null;
        this.dragging = false;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'resizable-handle-host';
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.endDrag();
    }

    private get group(): GeResizablePanelGroup | null {
        return this.closest<GeResizablePanelGroup>('ge-resizable-panel-group');
    }

    private get direction(): ResizableDirection {
        return this.group?.direction ?? 'horizontal';
    }

    private get rtl(): boolean {
        return getComputedStyle(this).direction === 'rtl';
    }

    /** The nearest panel on each side. The handle may sit inside a wrapper, so the search starts from the group's child that holds it. */
    private pair(): Pair | null {
        const group = this.group;
        if (!group) return null;
        const children = [...group.children];
        const index = children.findIndex((child) => child === this || child.contains(this));
        const before = children.slice(0, Math.max(index, 0)).reverse().find((child) => child instanceof GeResizablePanel);
        const after = children.slice(index + 1).find((child) => child instanceof GeResizablePanel);
        return before instanceof GeResizablePanel && after instanceof GeResizablePanel ? { before, after } : null;
    }

    private keyboardStep(key: string): number {
        if (this.direction === 'vertical') {
            if (key === 'ArrowUp') return -KEYBOARD_STEP;
            return key === 'ArrowDown' ? KEYBOARD_STEP : 0;
        }
        const sign = this.rtl ? -1 : 1;
        if (key === 'ArrowLeft') return -KEYBOARD_STEP * sign;
        return key === 'ArrowRight' ? KEYBOARD_STEP * sign : 0;
    }

    private readonly onKeydown = (event: KeyboardEvent) => {
        const step = this.keyboardStep(event.key);
        if (step === 0) return;
        event.preventDefault();
        const pair = this.pair();
        if (!pair) return;
        const { before, after } = pair;
        const total = before.size + after.size;
        const afterSize = after.clampSize(total - before.clampSize(before.size + step));
        const beforeSize = total - afterSize;
        before.setSize(beforeSize);
        after.setSize(afterSize);
        this.emit(0, beforeSize, afterSize);
    };

    private emit(delta: number, before: number, after: number): void {
        this.dispatchEvent(new CustomEvent('resized', { detail: { delta, sizes: [Math.round(before), Math.round(after)] }, bubbles: true, composed: true }));
    }

    private readonly onMouseDown = (event: MouseEvent) => {
        event.preventDefault();
        this.startDrag(event.clientX, event.clientY, false);
    };

    /** A single finger resizes; more than one is a pinch and is ignored. */
    private readonly onTouchStart = (event: TouchEvent) => {
        const touch = event.touches[0];
        if (event.touches.length !== 1 || !touch) return;
        event.preventDefault();
        this.startDrag(touch.clientX, touch.clientY, true);
    };

    private startDrag(startX: number, startY: number, touch: boolean): void {
        this.dragging = true;
        const group = this.group;
        const pair = this.pair();
        if (!group || !pair) return;
        const horizontal = this.direction === 'horizontal';
        const extent = (el: HTMLElement) => (horizontal ? el.offsetWidth : el.offsetHeight);
        const container = extent(group);
        const startBefore = extent(pair.before);
        const startAfter = extent(pair.after);
        const rtl = this.rtl;
        const move = (clientX: number, clientY: number) => {
            let delta = horizontal ? clientX - startX : clientY - startY;
            if (horizontal && rtl) delta = -delta;
            const before = ((startBefore + delta) / container) * 100;
            const after = ((startAfter - delta) / container) * 100;
            // Past either limit the move is dropped outright, so a fast drag stops dead at the limit.
            if (before < pair.before.minSize || after < pair.after.minSize || before > pair.before.maxSize || after > pair.after.maxSize) return;
            pair.before.setSize(before);
            pair.after.setSize(after);
            this.emit(delta, before, after);
        };
        this.listen(touch, horizontal, move);
    }

    private listen(touch: boolean, horizontal: boolean, move: (x: number, y: number) => void): void {
        const body = document.body;
        body.style.cursor = horizontal ? 'col-resize' : 'row-resize';
        body.style.userSelect = 'none';
        const end = () => this.endDrag();
        if (touch) {
            const onMove = (event: TouchEvent) => {
                const point = event.touches[0];
                if (event.touches.length !== 1 || !point) return;
                event.preventDefault();
                move(point.clientX, point.clientY);
            };
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', end);
            this.cleanup.push(() => document.removeEventListener('touchmove', onMove), () => document.removeEventListener('touchend', end));
        } else {
            const onMove = (event: MouseEvent) => move(event.clientX, event.clientY);
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', end);
            this.cleanup.push(() => document.removeEventListener('mousemove', onMove), () => document.removeEventListener('mouseup', end));
        }
    }

    private endDrag(): void {
        for (const remove of this.cleanup) remove();
        this.cleanup = [];
        this.dragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }

    protected override render() {
        if (this.disabled) return nothing;
        const horizontal = this.direction === 'horizontal';
        const pair = this.pair();
        const size = `${this.handleSize}px`;
        const style = horizontal ? `width:${size};min-width:${size}` : `height:${size};min-height:${size}`;
        return html`<div
            class="handle ${this.direction}${this.dragging ? ' dragging' : ''}"
            style=${style}
            data-slot="resizable-handle"
            role="separator"
            tabindex="0"
            aria-orientation=${horizontal ? 'vertical' : 'horizontal'}
            aria-valuenow=${Math.round(pair?.before.size ?? 50)}
            aria-valuemin=${pair?.before.minSize ?? 10}
            aria-valuemax=${pair?.before.maxSize ?? 90}
            aria-label=${this.ariaLabel ?? 'Resize Handle'}
            @mousedown=${this.onMouseDown}
            @touchstart=${this.onTouchStart}
            @keydown=${this.onKeydown}
        >
            ${this.withHandle ? html`<div class="grip">${DOTS}</div>` : nothing}
        </div>`;
    }
}
