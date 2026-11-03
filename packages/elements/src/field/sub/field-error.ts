import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { FIELD_REGISTER, type FieldHost } from '../field.js';
import css from './field-error.css?inline';

let nextId = 0;

/**
 * An error message for a control. It is an alert region (polite), so a message that appears is announced. It gets an `id` if it has none, which joins the field's `describedBy` beside any description.
 *
 * @slot - The text.
 * @attr {string} id - Element id; generated when empty.
 */
export class GeFieldError extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    private field?: FieldHost;

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'field-error-host';
        this.id ||= `ge-field-error-${++nextId}`;
        this.field = findParent<FieldHost, GeFieldError>(this, FIELD_REGISTER);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.field?.unregister(this);
        this.field = undefined;
    }

    protected override render() {
        return html`<p data-slot="field-error" role="alert" aria-live="polite"><slot></slot></p>`;
    }
}
