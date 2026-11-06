import { html, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { SORTABLE_REGISTER, type SortableHost } from '../sortable.js';
import css from './sortable-item.css?inline';

const HANDLE = 'ge-sortable-handle, [data-sortable-handle]';

function prefersReducedMotion(): boolean {
    return globalThis.window?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * One row of a `ge-sortable`. The element is the box: it is the flex row, the focus target and the thing that moves,
 * so put your own content (and a `ge-sortable-handle`, if you want one) inside it and style it with a class or `style`.
 *
 * @slot - The row's content.
 * @csspart base - The wrapper around the content.
 */
export class GeSortableItem extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        ghost: { type: Boolean, reflect: true },
    };

    /** Set on the faded copy shown at the drop gap; such a copy does nothing. */
    declare ghost: boolean;
    private parent?: SortableHost;
    private appliedPositionClass = '';
    private appliedRadius = '';

    constructor() {
        super();
        this.ghost = false;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'sortable-item';
        this.setAttribute('aria-roledescription', 'sortable');
        this.addEventListener('mousedown', this.onMouseDown);
        this.addEventListener('touchstart', this.onTouchStart, { passive: false });
        this.addEventListener('keydown', this.onKeyDown);
        if (!this.ghost) this.parent = findParent<SortableHost, GeSortableItem>(this, SORTABLE_REGISTER);
        this.parent?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener('mousedown', this.onMouseDown);
        this.removeEventListener('touchstart', this.onTouchStart);
        this.removeEventListener('keydown', this.onKeyDown);
        this.parent?.unregister(this);
        this.parent = undefined;
    }

    private get index(): number {
        return this.parent?.indexOf(this) ?? -1;
    }

    protected override updated(changed: PropertyValues<this>): void {
        void changed;
        this.syncState();
    }

    /** Mirrors the list's drag state onto the host: attributes for the look, inline style for the movement. */
    private syncState(): void {
        const parent = this.parent;
        const index = this.index;
        const disabled = parent?.disabled ?? false;
        const active = parent !== undefined && !this.ghost;
        const isSource = active && parent.dragSource === index;
        const isLifted = active && parent.liftedIndex === index;
        const draggable = active && !parent.handleOnly && !disabled;
        this.toggleAttribute('data-source', isSource);
        this.toggleAttribute('data-lifted', isLifted);
        this.toggleAttribute('data-draggable', draggable);
        if (active && !disabled) this.setAttribute('tabindex', '0');
        else this.removeAttribute('tabindex');
        if (active && disabled) this.setAttribute('aria-disabled', 'true');
        else this.removeAttribute('aria-disabled');
        this.style.transform = '';
        if (isSource) {
            const delta = parent.effectiveDragDelta;
            const lift = prefersReducedMotion() ? '' : ' scale(1.02) rotate(1.5deg)';
            this.style.transform = `translate(${delta.x}px, ${delta.y}px)${lift}`;
        }
        this.applyPositionClass(active ? parent.positionClassFor(this) : '');
        this.followContentRadius();
    }

    /**
     * The focus ring, lift ring, drag shadow and land glow are drawn on this box, so they take the corners of the row's
     * own content: a square-cornered ring around a rounded card reads as a glitch. A radius you set on the row wins.
     */
    private followContentRadius(): void {
        if (this.style.borderRadius !== '' && this.style.borderRadius !== this.appliedRadius) return;
        const content = [...this.children].find((child) => child instanceof HTMLElement && !child.matches(HANDLE));
        const radius = content ? getComputedStyle(content).borderRadius : '';
        const next = radius === '0px' ? '' : radius;
        if (next === this.appliedRadius) return;
        this.style.borderRadius = next;
        this.appliedRadius = next;
    }

    private applyPositionClass(next: string): void {
        if (next === this.appliedPositionClass) return;
        for (const name of this.appliedPositionClass.split(/\s+/).filter(Boolean)) this.classList.remove(name);
        for (const name of next.split(/\s+/).filter(Boolean)) this.classList.add(name);
        this.appliedPositionClass = next;
    }

    /**
     * Whether an event aimed at this row is this row's to answer: an event from a row nested inside belongs to that row,
     * and a drag starts on the handle, or anywhere on the row unless the list is `handle-only`.
     */
    private ownsEvent(event: Event, needsHandle: boolean): boolean {
        if (this.ghost || this.parent === undefined) return false;
        const path = event.composedPath();
        const nearest = path.find((node) => node instanceof Element && node.localName === 'ge-sortable-item');
        if (nearest !== this) return false;
        if (!this.parent.handleOnly && !needsHandle) return true;
        return path.slice(0, path.indexOf(this)).some((node) => node instanceof Element && node.matches(HANDLE));
    }

    private readonly onMouseDown = (event: MouseEvent) => {
        if (event.button !== 0 || !this.ownsEvent(event, false)) return;
        this.parent?.startDrag(this.index, event.clientX, event.clientY);
    };

    private readonly onTouchStart = (event: TouchEvent) => {
        const touch = event.touches[0];
        if (!touch || !this.ownsEvent(event, false)) return;
        // With touch-action: none this makes the gesture drag the row instead of scrolling the page.
        event.preventDefault();
        this.parent?.startDrag(this.index, touch.clientX, touch.clientY);
    };

    private readonly onKeyDown = (event: KeyboardEvent) => {
        // Keys typed into a control inside the row, or a row nested in it, are theirs.
        if (this.ghost || event.target !== this) return;
        this.parent?.handleItemKeyDown(this.index, event);
    };

    protected override render() {
        return html`<slot part="base"></slot>`;
    }
}
