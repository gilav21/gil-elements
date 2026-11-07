import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { FIELD_REGISTER, type FieldHost } from '../field.js';
import css from './field-description.css?inline';

let nextId = 0;

/**
 * Helper text under a control. It gets an `id` if it has none, which joins the field's `describedBy`.
 *
 * @slot - The text.
 * @attr {string} id - Element id; generated when empty.
 */
export class GeFieldDescription extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];

    private field?: FieldHost;

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'field-description-host';
        this.id ||= `ge-field-description-${++nextId}`;
        this.field = findParent<FieldHost, GeFieldDescription>(this, FIELD_REGISTER);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.field?.unregister(this);
        this.field = undefined;
    }

    protected override render() {
        return html`<p data-slot="field-description"><slot></slot></p>`;
    }
}
