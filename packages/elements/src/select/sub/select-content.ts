import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { clippingRect } from '../../shared/anchor.js';
import { resolveIdRefs } from '../../shared/aria-refs.js';
import { findParent } from '../../shared/compound.js';
import { SELECT_REGISTER, type SelectHost, type SelectPosition } from '../select.js';
import css from './select-content.css?inline';

const ITEM = '[data-slot="select-item"]';
/** Kept between the panel and the edge of what is visible. */
const VIEWPORT_PADDING = 8;

type Side = 'top' | 'bottom';

/** Scrolls `list` just far enough that `option` is not cut off at the bottom. */
function reveal(list: HTMLElement, option: HTMLElement): void {
    const listBottom = list.getBoundingClientRect().top + list.clientTop + list.clientHeight;
    list.scrollTop += Math.max(0, option.getBoundingClientRect().bottom - listBottom);
}

/**
 * The panel (`role="listbox"`); it draws nothing until the select is open. When it opens, focus moves to the
 * selected row, or to the panel when nothing is selected. Up and Down move through the rows and wrap around
 * the ends (they stop at the ends when the select is built from `options`); Enter and Space pick the focused row.
 *
 * With `item-aligned` the panel is placed so the selected row sits on top of the trigger; it falls back to
 * `popper` when that would run off the visible area. `popper` opens beside the trigger on the side with more room.
 *
 * @slot - Rows, groups, labels and separators.
 * @attr {'item-aligned' | 'popper'} position - Used only without a parent `ge-select`, whose own `position` wins.
 * @attr {'top' | 'bottom'} side - Preferred side for `popper`. Only a preference: it flips when the other side has more room.
 */
export class GeSelectContent extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        position: { reflect: true },
        side: { reflect: true },
    };

    declare position: SelectPosition;
    declare side: Side;
    private select?: SelectHost;
    private wasOpen = false;

    constructor() {
        super();
        this.position = 'item-aligned';
        this.side = 'bottom';
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'listbox');
        this.tabIndex = -1;
        this.dataset.slot = 'select-content';
        this.select = findParent<SelectHost, GeSelectContent>(this, SELECT_REGISTER);
        this.select?.register(this);
        this.addEventListener('keydown', this.onKeydown);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener('keydown', this.onKeydown);
        this.select?.unregister(this);
        this.select = undefined;
    }

    private get requested(): SelectPosition {
        if (this.select?.dataDriven) return 'popper';
        return this.select?.position ?? this.position;
    }

    private get rows(): HTMLElement[] {
        return [...this.querySelectorAll<HTMLElement>(`${ITEM}:not([data-disabled])`)];
    }

    private apply(position: SelectPosition, side: Side, top?: number): void {
        this.dataset.position = position;
        this.dataset.side = side;
        if (top === undefined) this.style.removeProperty('top');
        else this.style.top = `${top}px`;
    }

    private selectedOffset(): number {
        const row = this.querySelector<HTMLElement>('[data-state="checked"]') ?? this.querySelector<HTMLElement>(ITEM);
        if (!row) return 0;
        return row.getBoundingClientRect().top - this.getBoundingClientRect().top - this.clientTop + this.scrollTop;
    }

    private place(): void {
        const trigger = this.select?.trigger;
        if (this.requested === 'item-aligned') {
            const offset = this.selectedOffset();
            if (!trigger) return this.apply('item-aligned', 'bottom', -(offset + 4));
            const bounds = clippingRect(this);
            const top = trigger.getBoundingClientRect().top - offset - 4;
            const fits = top >= bounds.top + VIEWPORT_PADDING && top + this.scrollHeight <= bounds.bottom - VIEWPORT_PADDING;
            if (fits) return this.apply('item-aligned', 'bottom', -(offset + 4));
        }
        this.apply('popper', this.popperSide(trigger));
    }

    private popperSide(trigger: HTMLElement | null | undefined): Side {
        if (this.select?.dataDriven) return 'bottom';
        if (!trigger) return this.side;
        const anchor = trigger.getBoundingClientRect();
        const bounds = clippingRect(this);
        const height = this.scrollHeight;
        const below = bounds.bottom - anchor.bottom - VIEWPORT_PADDING;
        const above = anchor.top - bounds.top - VIEWPORT_PADDING;
        if (this.side === 'top') return height <= above || above >= below ? 'top' : 'bottom';
        return height <= below || below >= above ? 'bottom' : 'top';
    }

    private focusInitial(): void {
        const selected = this.querySelector<HTMLElement>('[data-state="checked"]');
        const target = selected ?? (this.select?.dataDriven ? this.rows[0] : undefined);
        if (target) {
            target.focus({ preventScroll: true });
            reveal(this, target);
        } else {
            this.focus({ preventScroll: true });
        }
    }

    private readonly onKeydown = (event: KeyboardEvent) => {
        const rows = this.rows;
        const current = rows.indexOf(event.target as HTMLElement);
        const dataDriven = this.select?.dataDriven ?? false;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const step = event.key === 'ArrowDown' ? 1 : -1;
            const next = dataDriven ? current + step : (current + step + rows.length) % rows.length;
            rows[next]?.focus();
        } else if ((event.key === 'Enter' || event.key === ' ') && current >= 0) {
            event.preventDefault();
            rows[current]?.click();
        } else if (event.key === 'Tab') {
            // The list is not part of the page's tab order: Tab closes it and focus goes back to the trigger.
            event.preventDefault();
            this.select?.hide();
        }
    };

    // The name of the listbox is the name of the control: the select's label, else its placeholder.
    private syncName(): void {
        const host = this.select?.host;
        const labelledBy = host?.getAttribute('aria-labelledby') ?? null;
        this.ariaLabelledByElements = host ? resolveIdRefs(host, labelledBy) : null;
        if (labelledBy) this.removeAttribute('aria-label');
        else this.setAttribute('aria-label', host?.getAttribute('aria-label') ?? this.select?.resolvedPlaceholder ?? 'Options');
    }

    protected override updated(): void {
        this.syncName();
        const open = this.select?.open ?? false;
        if (open) this.dataset.state = 'open';
        else delete this.dataset.state;
        this.toggleAttribute('data-driven', this.select?.dataDriven ?? false);
        if (open === this.wasOpen) return;
        this.wasOpen = open;
        if (!open) return;
        this.apply(this.requested, this.side);
        setTimeout(() => {
            this.place();
            this.focusInitial();
        });
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
