import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { adoptChildren, byDocumentOrder } from '../shared/compound.js';
import css from './field.css?inline';

export const FIELD_REGISTER = 'ge-field-register';

export type FieldOrientation = 'vertical' | 'horizontal';

/** A part whose element id joins the field's `describedBy`: a description or an error. */
export type FieldDescription = HTMLElement;

export interface FieldHost extends HTMLElement {
    register(part: FieldDescription): void;
    unregister(part: FieldDescription): void;
}

/**
 * A form field: a label, a control and helper text laid out together.
 *
 * Put a `ge-field-label`, your control, and any `ge-field-description` or `ge-field-error` inside. The field
 * does not wire the label for you: give the control an `id` and the label a matching `for`. What it does keep is
 * the ids of the descriptions and errors it holds, in document order, as `describedBy`: bind that to the
 * control's `aria-describedby`.
 *
 * @slot - Label, control, descriptions, errors.
 * @fires described-by-change - When a description or error is added or removed. Read `describedBy` for the new list.
 * @attr {'vertical' | 'horizontal'} orientation - `vertical` stacks label, control and helper text. `horizontal` puts them in a centred row, for a checkbox or switch beside its label.
 * @csspart field - The layout box.
 */
export class GeField extends UiElement implements FieldHost {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = { orientation: { reflect: true } };

    declare orientation: FieldOrientation;
    private readonly parts = new Set<FieldDescription>();

    constructor() {
        super();
        this.orientation = 'vertical';
        adoptChildren<FieldHost, FieldDescription>(this, FIELD_REGISTER, (part) => this.register(part));
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'field-host';
    }

    /** Space-separated ids of the descriptions and errors in this field, or `null` when there are none. */
    get describedBy(): string | null {
        const ids = [...this.parts].sort(byDocumentOrder).map((part) => part.id);
        return ids.length > 0 ? ids.join(' ') : null;
    }

    register(part: FieldDescription): void {
        this.parts.add(part);
        this.announce();
    }

    unregister(part: FieldDescription): void {
        if (this.parts.delete(part)) this.announce();
    }

    private announce(): void {
        this.dispatchEvent(new CustomEvent('described-by-change', { bubbles: true, composed: true }));
    }

    protected override render() {
        return html`<div class="field" part="field" data-slot="field" data-orientation=${this.orientation}><slot></slot></div>`;
    }
}
