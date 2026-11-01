import { html, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { adoptChildren } from '../shared/compound.js';
import css from './accordion.css?inline';

export const ACCORDION_REGISTER = 'ge-accordion-register';
export type AccordionType = 'single' | 'multiple';

/** An item or one of its parts: re-rendered whenever the accordion's state changes. */
export type AccordionPart = HTMLElement & { requestUpdate(): void };

/** The part of the accordion its items talk to. */
export interface AccordionHost {
    isOpen(value: string): boolean;
    toggle(value: string): void;
    register(item: AccordionPart): void;
    unregister(item: AccordionPart): void;
}

const commaList = {
    fromAttribute: (attribute: string | null): string[] => (attribute ? attribute.split(',').map((v) => v.trim()).filter(Boolean) : []),
    toAttribute: (value: string[]): string => value.join(','),
};
/** `collapsible` is on unless the attribute says `false`, because a bare boolean attribute cannot default to true. */
const defaultTrue = { fromAttribute: (attribute: string | null): boolean => attribute !== 'false' };

/**
 * A stack of items that each open to reveal a panel. Use `ge-accordion-item` with `title` and `content` for the
 * quick form, or put a `ge-accordion-trigger` and `ge-accordion-content` inside an item to design them yourself.
 *
 * @slot - `ge-accordion-item`s.
 * @fires change - After the user opens or closes an item; read `value`.
 * @attr {'single' | 'multiple'} type - `single` keeps at most one item open; `multiple` lets any number stay open.
 * @attr {string} value - Values of the open items, comma-separated. In `single` only the first counts. Read it back after `change`.
 * @attr {boolean} collapsible - In `single`, whether pressing the open item closes it. On unless set to `false`; ignored by `multiple`.
 */
export class GeAccordion extends UiElement implements AccordionHost {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        type: { reflect: true },
        value: { converter: commaList },
        collapsible: { converter: defaultTrue, reflect: true },
    };

    declare type: AccordionType;
    declare value: string[];
    declare collapsible: boolean;

    private readonly items = new Set<AccordionPart>();

    constructor() {
        super();
        this.type = 'single';
        this.value = [];
        this.collapsible = true;
        adoptChildren<AccordionHost, AccordionPart>(this, ACCORDION_REGISTER, (item) => this.register(item));
    }

    register(item: AccordionPart): void {
        this.items.add(item);
        item.requestUpdate();
    }

    unregister(item: AccordionPart): void {
        this.items.delete(item);
    }

    isOpen(value: string): boolean {
        return this.value.includes(value);
    }

    /** Open the item if closed and close it otherwise, honouring `type` and `collapsible`, and announce it when something changed. */
    toggle(value: string): void {
        const next = this.next(value);
        if (next === this.value) return;
        this.value = next;
        this.dispatchEvent(new Event('change', { bubbles: true }));
    }

    private next(value: string): string[] {
        const open = this.isOpen(value);
        if (this.type === 'multiple') return open ? this.value.filter((v) => v !== value) : [...this.value, value];
        if (!open) return [value];
        return this.collapsible ? [] : this.value;
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (changed.has('value') && this.type === 'single' && this.value.length > 1) this.value = this.value.slice(0, 1);
    }

    protected override updated(): void {
        for (const item of this.items) item.requestUpdate();
    }

    protected override render() {
        return html`<div class="accordion" data-slot="accordion"><slot></slot></div>`;
    }
}
