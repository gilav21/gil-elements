import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { INTERACTIVE } from '../shared/activator.js';
import { adoptChildren } from '../shared/compound.js';
import { registerLayer } from '../shared/overlay.js';
import css from './popover.css?inline';

export const POPOVER_REGISTER = 'ge-popover-register';

/** What the parts of a popover need from it. */
export interface PopoverHost {
    readonly open: boolean;
    show(): void;
    hide(): void;
    toggle(): void;
    /** The trigger's live box, which the content anchors to. */
    triggerRect(): DOMRect | null;
    /** Where focus goes back to when the content closes. */
    triggerFocusTarget(): HTMLElement | null;
    register(part: PopoverPart): void;
    unregister(part: PopoverPart): void;
}

/** A part that re-renders when the popover opens or closes. */
export interface PopoverPart extends HTMLElement {
    requestUpdate(): void;
}

/**
 * A panel anchored to a trigger. This element holds the open state; put a `ge-popover-trigger` and a
 * `ge-popover-content` inside it. A click outside closes it, and Escape closes the innermost open overlay only.
 * Unlike a dialog it does not lock the page or trap focus.
 *
 * @slot - `ge-popover-trigger` and `ge-popover-content`.
 * @attr {boolean} open - Whether the popover is showing.
 * @attr {boolean} close-on-scroll - Closes when anything outside the popover scrolls.
 * @fires open-change - When the user opens or closes it; `detail` is the new state. Setting `open` yourself does not fire it.
 */
export class GePopover extends UiElement implements PopoverHost {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        open: { type: Boolean, reflect: true },
        closeOnScroll: { type: Boolean, attribute: 'close-on-scroll' },
    };

    declare open: boolean;
    declare closeOnScroll: boolean;
    private readonly parts = new Set<PopoverPart>();
    private release?: () => void;
    private stopScrollWatch?: () => void;

    constructor() {
        super();
        this.open = false;
        this.closeOnScroll = false;
        adoptChildren<PopoverHost, PopoverPart>(this, POPOVER_REGISTER, (part) => this.register(part));
    }

    override connectedCallback(): void {
        super.connectedCallback();
        document.addEventListener('click', this.onOutsideClick);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        document.removeEventListener('click', this.onOutsideClick);
        this.release?.();
        this.release = undefined;
        this.stopScrollWatch?.();
        this.stopScrollWatch = undefined;
    }

    register(part: PopoverPart): void {
        this.parts.add(part);
    }

    unregister(part: PopoverPart): void {
        this.parts.delete(part);
    }

    show(): void {
        this.setOpen(true);
    }

    hide(): void {
        this.setOpen(false);
    }

    toggle(): void {
        this.setOpen(!this.open);
    }

    triggerRect(): DOMRect | null {
        // The trigger host draws no box of its own (display: contents); its wrapper is the box.
        return this.querySelector('ge-popover-trigger')?.shadowRoot?.querySelector('[part="base"]')?.getBoundingClientRect() ?? null;
    }

    triggerFocusTarget(): HTMLElement | null {
        const trigger = this.querySelector<HTMLElement>('ge-popover-trigger');
        return trigger?.querySelector<HTMLElement>(INTERACTIVE) ?? trigger?.shadowRoot?.querySelector<HTMLElement>('[part="base"]') ?? null;
    }

    private setOpen(next: boolean): void {
        if (this.open === next) return;
        this.open = next;
        this.dispatchEvent(new CustomEvent<boolean>('open-change', { detail: next, bubbles: true, composed: true }));
    }

    // composedPath, because the click's target is retargeted to the outermost host once it leaves a shadow root.
    private readonly onOutsideClick = (event: MouseEvent) => {
        if (this.open && !event.composedPath().includes(this)) this.hide();
    };

    protected override updated(changed: Map<PropertyKey, unknown>): void {
        if (changed.has('open')) this.syncLayer();
        if (changed.has('open') || changed.has('closeOnScroll')) this.syncScrollWatch();
        for (const part of this.parts) part.requestUpdate();
    }

    private syncLayer(): void {
        this.release?.();
        this.release = this.open && this.isConnected ? registerLayer({ modal: false, dismiss: () => this.hide() }) : undefined;
    }

    private syncScrollWatch(): void {
        this.stopScrollWatch?.();
        this.stopScrollWatch = undefined;
        if (!this.open || !this.closeOnScroll) return;
        // After this task: the scroll that a click-to-open itself causes must not close it straight away.
        const timer = setTimeout(() => {
            const onScroll = (event: Event) => {
                if (!event.composedPath().includes(this)) this.hide();
            };
            globalThis.addEventListener('scroll', onScroll, { capture: true, passive: true });
            this.stopScrollWatch = () => globalThis.removeEventListener('scroll', onScroll, { capture: true });
        }, 0);
        this.stopScrollWatch = () => clearTimeout(timer);
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
