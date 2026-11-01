import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { adoptChildren, findParent } from '../../shared/compound.js';
import { ACCORDION_REGISTER, type AccordionHost, type AccordionPart } from '../accordion.js';
import css from './accordion-item.css?inline';

export const ACCORDION_ITEM_REGISTER = 'ge-accordion-item-register';

/** The part of an item its trigger and content talk to. */
export interface AccordionItemHost {
    readonly value: string;
    readonly isOpen: boolean;
    toggle(): void;
    register(part: AccordionPart): void;
    unregister(part: AccordionPart): void;
}

/**
 * One section of a `ge-accordion`. Give it a `heading` (and `content`) for the quick form, or project a
 * `ge-accordion-trigger` and `ge-accordion-content` for full control.
 *
 * @slot - A `ge-accordion-trigger` and `ge-accordion-content`, used when there is no `heading`.
 * @attr {string} value - Identifies the item in the accordion's `value`. Required.
 * @attr {string} heading - Quick form: the trigger's label (not `title`, which would add a browser tooltip).
 * @attr {string} content - Quick form: the panel's text.
 * @attr {boolean} skeleton - Shows a placeholder row instead of the item.
 */
export class GeAccordionItem extends UiElement implements AccordionItemHost {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        value: { reflect: true },
        heading: {},
        content: {},
        skeleton: { type: Boolean, reflect: true },
    };

    declare value: string;
    declare heading: string;
    declare content: string;
    declare skeleton: boolean;

    private accordion?: AccordionHost;
    private readonly parts = new Set<AccordionPart>();

    constructor() {
        super();
        this.value = '';
        this.heading = '';
        this.content = '';
        this.skeleton = false;
        adoptChildren<AccordionItemHost, AccordionPart>(this, ACCORDION_ITEM_REGISTER, (part) => this.register(part));
    }

    get isOpen(): boolean {
        return this.accordion?.isOpen(this.value) ?? false;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.accordion = findParent<AccordionHost, GeAccordionItem>(this, ACCORDION_REGISTER);
        this.accordion?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.accordion?.unregister(this);
        this.accordion = undefined;
    }

    register(part: AccordionPart): void {
        this.parts.add(part);
        part.requestUpdate();
    }

    unregister(part: AccordionPart): void {
        this.parts.delete(part);
    }

    toggle(): void {
        this.accordion?.toggle(this.value);
    }

    protected override updated(): void {
        for (const part of this.parts) part.requestUpdate();
    }

    protected override render() {
        return html`<div class="item" data-slot="accordion-item">${this.skeleton ? this.renderSkeleton() : this.heading ? this.renderQuick() : html`<slot></slot>`}</div>`;
    }

    private renderSkeleton() {
        return html`<div class="skeleton"><ge-skeleton></ge-skeleton><ge-skeleton></ge-skeleton></div>`;
    }

    private renderQuick() {
        return html`<ge-accordion-trigger>${this.heading}</ge-accordion-trigger><ge-accordion-content>${this.content || nothing}</ge-accordion-content>`;
    }
}
