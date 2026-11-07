import { html, nothing, svg, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import type { ButtonSize, ButtonVariant } from '../button/button.js';
import { registerLayer } from '../shared/overlay.js';
import { adoptChildren } from '../shared/compound.js';
import css from './split-button.css?inline';
import itemCss from './sub/split-button-item.css?inline';

export const SPLIT_BUTTON_REGISTER = 'ge-split-button-register';

/** A row of the menu. In custom mode `label` is empty and `value` tells the rows apart. */
export interface SplitButtonItem {
    label: string;
    value?: string;
    icon?: string;
    disabled?: boolean;
    click?: (item: SplitButtonItem) => void;
}

/** What the projected parts need from their split button. */
export interface SplitButtonHost {
    readonly variant: ButtonVariant;
    readonly size: ButtonSize;
    readonly disabled: boolean;
    emitPrimary(event: MouseEvent): void;
    activate(item: SplitButtonItem): void;
    watch(part: HTMLElement): void;
    unwatch(part: HTMLElement): void;
}

const CHEVRON = (open: boolean) => svg`<svg class="chevron ${open ? 'open' : ''}" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>`;

/** Room a menu needs below the group before it opens upward instead. */
const MENU_ROOM = 150;

/**
 * A button with a primary action and a dropdown menu.
 *
 * Simple mode: set `label` and the `items` property. Custom mode: slot a `ge-split-button-primary` and a
 * `ge-split-button-menu` holding `ge-split-button-item`s. A non-empty `label` wins over a projected primary and
 * non-empty `items` win over a projected menu.
 *
 * Enter, Space or ArrowDown on the toggle opens the menu and focuses its first row; ArrowUp and ArrowDown walk the
 * enabled rows and wrap; Escape closes and returns focus to the toggle; Tab closes.
 *
 * @fires primary-click - The primary half was clicked; `detail` is the click event. The toggle never fires it.
 * @fires item-click - A menu row was activated, just before the menu closes; `detail` is the item. A projected row sends `{ label: '', value }`.
 * @attr {string} label - Text of the primary half (simple mode).
 * @attr {'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'} variant - Applied to both halves.
 * @attr {'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg'} size - Applied to both halves.
 * @attr {boolean} disabled - Disables both halves.
 * @attr {boolean} open - Whether the menu is showing.
 * @attr {string} dropdown-label - Accessible name of the toggle. Defaults to "More options".
 */
export class GeSplitButton extends UiElement implements SplitButtonHost {
    static override readonly styles = [UiElement.styles, unsafeCSS(css), unsafeCSS(itemCss)];
    static override readonly properties = {
        label: { reflect: true },
        items: { attribute: false },
        variant: { reflect: true },
        size: { reflect: true },
        disabled: { type: Boolean, reflect: true },
        open: { type: Boolean, reflect: true },
        dropdownLabel: { attribute: 'dropdown-label' },
        above: { state: true },
    };

    declare label: string;
    /** Menu entries for simple mode. */
    declare items: readonly SplitButtonItem[];
    declare variant: ButtonVariant;
    declare size: ButtonSize;
    declare disabled: boolean;
    declare open: boolean;
    declare dropdownLabel: string;
    declare above: boolean;

    private releaseLayer?: () => void;
    private readonly watched = new Set<HTMLElement>();

    constructor() {
        super();
        this.label = '';
        this.items = [];
        this.variant = 'default';
        this.size = 'default';
        this.disabled = false;
        this.open = false;
        this.dropdownLabel = 'More options';
        this.above = false;
        adoptChildren<SplitButtonHost, HTMLElement>(this, SPLIT_BUTTON_REGISTER, () => undefined);
    }

    watch(part: HTMLElement): void {
        this.watched.add(part);
    }

    unwatch(part: HTMLElement): void {
        this.watched.delete(part);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.releaseLayer?.();
        this.releaseLayer = undefined;
        document.removeEventListener('click', this.onDocumentClick);
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (changed.has('items')) this.toggleAttribute('data-has-items', this.items.length > 0);
    }

    protected override updated(changed: PropertyValues<this>): void {
        if (changed.has('variant') || changed.has('size') || changed.has('disabled')) {
            for (const part of this.watched) (part as HTMLElement & { requestUpdate(): void }).requestUpdate();
        }
        if (changed.has('open')) this.syncOpen();
    }

    private syncOpen(): void {
        if (this.open) {
            this.releaseLayer = registerLayer({ modal: false, dismiss: () => this.closeAndFocusToggle() });
            document.addEventListener('click', this.onDocumentClick);
        } else {
            this.releaseLayer?.();
            this.releaseLayer = undefined;
            document.removeEventListener('click', this.onDocumentClick);
        }
    }

    private readonly onDocumentClick = (event: MouseEvent) => {
        if (!event.composedPath().includes(this)) this.open = false;
    };

    private get toggle(): HTMLElement | null {
        return this.shadowRoot?.querySelector<HTMLElement>('.dropdown') ?? null;
    }

    private closeAndFocusToggle(): void {
        this.toggle?.focus();
        this.open = false;
    }

    emitPrimary(event: MouseEvent): void {
        this.dispatchEvent(new CustomEvent('primary-click', { detail: event, bubbles: true, composed: true }));
    }

    activate(item: SplitButtonItem): void {
        this.dispatchEvent(new CustomEvent('item-click', { detail: item, bubbles: true, composed: true }));
        this.open = false;
    }

    private placeMenu(): void {
        const rect = this.shadowRoot?.querySelector<HTMLElement>('.group')?.getBoundingClientRect();
        this.above = rect ? globalThis.innerHeight - rect.bottom < MENU_ROOM : false;
        this.toggleAttribute('data-above', this.above);
    }

    private readonly onToggle = () => {
        if (!this.open) this.placeMenu();
        this.open = !this.open;
    };

    /** The rows that can take focus, in order: the data rows, or the projected rows that are not disabled. */
    private rows(): HTMLElement[] {
        const own = [...(this.shadowRoot?.querySelectorAll<HTMLElement>('.item:not([disabled])') ?? [])];
        if (own.length > 0) return own;
        return [...this.querySelectorAll<HTMLElement>('ge-split-button-item:not([disabled])')];
    }

    private focusedRow(rows: HTMLElement[]): number {
        const own = this.shadowRoot?.activeElement;
        return rows.findIndex((row) => row === own || row === document.activeElement);
    }

    private readonly onToggleKeydown = (event: KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'ArrowDown') return;
        event.preventDefault();
        this.placeMenu();
        this.open = true;
        setTimeout(() => this.rows()[0]?.focus());
    };

    private readonly onMenuKeydown = (event: KeyboardEvent) => {
        // The toggle's own keys are handled on the toggle.
        if (!this.open || event.composedPath().includes(this.toggle as EventTarget)) return;
        if (event.key === 'Tab') {
            this.open = false;
            return;
        }
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        const rows = this.rows();
        const current = this.focusedRow(rows);
        const down = event.key === 'ArrowDown';
        const downNext = current < rows.length - 1 ? current + 1 : 0;
        const upNext = current > 0 ? current - 1 : rows.length - 1;
        const next = down ? downNext : upNext;
        rows[next]?.focus();
    };

    private dataRow(item: SplitButtonItem) {
        const click = () => {
            this.activate(item);
            item.click?.(item);
        };
        return html`<button class="item" type="button" role="menuitem" tabindex="-1" ?disabled=${item.disabled} @click=${click}>
            ${item.icon ? html`<span class="icon">${item.icon}</span>` : nothing}${item.label}
        </button>`;
    }

    protected override render() {
        const hasItems = this.items.length > 0;
        const side = this.above ? 'above' : 'below';
        return html`<div class="group" role="group" data-slot="split-button" @keydown=${this.onMenuKeydown}>
            ${this.label
                ? html`<ge-button
                      style="--ge-join-se: 0px; --ge-join-ee: 0px; --ge-join-border-inline-end: 0px"
                      variant=${this.variant}
                      size=${this.size}
                      ?disabled=${this.disabled}
                      type="button"
                      @click=${(event: MouseEvent) => this.emitPrimary(event)}
                      >${this.label}</ge-button
                  >`
                : nothing}
            <slot></slot>
            <ge-button
                class="dropdown"
                data-split-divider
                variant=${this.variant}
                size=${this.size}
                ?disabled=${this.disabled}
                type="button"
                aria-haspopup="menu"
                aria-label=${this.dropdownLabel}
                aria-expanded=${this.open ? 'true' : 'false'}
                @click=${this.onToggle}
                @keydown=${this.onToggleKeydown}
                >${CHEVRON(this.open)}</ge-button
            >
            ${hasItems && this.open
                ? html`<div class="menu ${side}" role="menu" tabindex="-1">${this.items.map((item) => this.dataRow(item))}</div>`
                : nothing}
        </div>`;
    }
}
