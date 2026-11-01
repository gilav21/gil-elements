import { html, nothing, unsafeCSS } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { UiElement } from '@gilav21/elements-base';
import { adoptChildren, byDocumentOrder } from '../shared/compound.js';
import type { GeToggleGroupItem } from './sub/toggle-group-item.js';
import css from './toggle-group.css?inline';

export type ToggleGroupType = 'single' | 'multiple';
export type ToggleGroupVariant = 'default' | 'outline';
export type ToggleGroupSize = 'default' | 'sm' | 'lg';

/** One entry for data-driven mode. */
export interface ToggleGroupOption {
    value: string;
    label?: string;
    disabled?: boolean;
}

export const TOGGLE_GROUP_REGISTER = 'ge-toggle-group-register';

/** The part of the group an item talks to. */
export interface ToggleGroupHost {
    readonly variant: ToggleGroupVariant;
    readonly size: ToggleGroupSize;
    readonly isDisabled: boolean;
    isSelected(value: string): boolean;
    toggle(value: string): void;
    register(item: GeToggleGroupItem): void;
    unregister(item: GeToggleGroupItem): void;
}

function toArray(value: string | readonly string[] | undefined, type: ToggleGroupType): string[] {
    if (Array.isArray(value)) return [...value];
    if (typeof value !== 'string' || value === '') return [];
    return type === 'multiple' ? value.split(',') : [value];
}

/**
 * A row of toggle buttons that share a selection: one at a time (`single`) or any number (`multiple`).
 *
 * Items register with the nearest group through an event, so they may be children, wrapped, or rendered
 * from `options`. They sit flush; only the outer corners stay round and neighbouring borders merge.
 *
 * @slot - `ge-toggle-group-item`s.
 * @fires change - When the user changes the selection; read `value`.
 * @fires input - Alongside `change`.
 * @attr {'single' | 'multiple'} type - How many items can be on at once. Defaults to `single`.
 * @attr {'default' | 'outline'} variant - Plain, or with borders and a shadow.
 * @attr {'default' | 'sm' | 'lg'} size - Height and padding of every item.
 * @attr {boolean} disabled - Disables every item.
 * @attr {string} value - Selected value; for `multiple`, a comma-separated list. As a property it is a string, or an array for `multiple`.
 * @attr {string} aria-label - Accessible name of the group.
 */
export class GeToggleGroup extends UiElement implements ToggleGroupHost {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        type: { reflect: true },
        variant: { reflect: true },
        size: { reflect: true },
        disabled: { type: Boolean, reflect: true },
        value: { reflect: true },
        options: { attribute: false },
        ariaLabel: { attribute: 'aria-label' },
    };

    declare type: ToggleGroupType;
    declare variant: ToggleGroupVariant;
    declare size: ToggleGroupSize;
    declare disabled: boolean;
    declare value: string | string[] | undefined;
    /** Data-driven mode: one item per entry. Children are rendered after them. */
    declare options: readonly ToggleGroupOption[] | undefined;
    declare ariaLabel: string | null;

    private readonly items = new Set<GeToggleGroupItem>();

    constructor() {
        super();
        this.type = 'single';
        this.variant = 'default';
        this.size = 'default';
        this.disabled = false;
        this.value = undefined;
        this.options = undefined;
        this.ariaLabel = null;
        adoptChildren<ToggleGroupHost, GeToggleGroupItem>(this, TOGGLE_GROUP_REGISTER, (item) => this.register(item));
    }

    get isDisabled(): boolean {
        return this.disabled;
    }

    private get selection(): string[] {
        return toArray(this.value, this.type);
    }

    isSelected(value: string): boolean {
        return this.selection.includes(value);
    }

    register(item: GeToggleGroupItem): void {
        this.items.add(item);
        this.requestUpdate();
    }

    unregister(item: GeToggleGroupItem): void {
        this.items.delete(item);
        this.requestUpdate();
    }

    /** Flip one item the way a click does, and announce it. */
    toggle(value: string): void {
        if (this.isDisabled) return;
        const current = this.selection;
        let next: string[];
        if (this.type === 'single') next = current.includes(value) ? [] : [value];
        else next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
        this.value = this.type === 'single' ? (next[0] ?? '') : next;
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        this.dispatchEvent(new Event('change', { bubbles: true }));
    }

    protected override updated(): void {
        const ordered = [...this.items].sort(byDocumentOrder);
        for (const [index, item] of ordered.entries()) {
            // An outline join beside an item that is on would vanish (same colour as the pressed fill), so it is drawn darker.
            const next = ordered[index + 1];
            item.divider = this.variant === 'outline' && next !== undefined && (this.isSelected(item.value) || this.isSelected(next.value));
            item.requestUpdate();
        }
    }

    protected override render() {
        return html`<div class=${this.variant === 'outline' ? 'group outline' : 'group'} role="group" aria-label=${this.ariaLabel ?? nothing}>
            ${repeat(
                this.options ?? [],
                (option) => option.value,
                (option) =>
                    html`<ge-toggle-group-item .value=${option.value} ?disabled=${option.disabled ?? false} aria-label=${option.label ?? nothing}
                        >${option.label ?? option.value}</ge-toggle-group-item
                    >`,
            )}<slot></slot>
        </div>`;
    }
}
