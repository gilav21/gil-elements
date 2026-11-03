import { html, unsafeCSS } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import { UiElement } from '@gilav21/elements-base';
import css from './field-set.css?inline';
import type { GeFieldLegend } from './field-legend.js';

/**
 * A semantic group of related fields: a native `<fieldset>` with its border and padding removed, laid out as a
 * grid. A `ge-field-legend` inside names the group for assistive technology.
 *
 * @slot - An optional `ge-field-legend`, then `ge-field`s.
 * @csspart set - The `<fieldset>`.
 */
export class GeFieldSet extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    private readonly fieldset = createRef<HTMLFieldSetElement>();

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'field-set-host';
    }

    // A legend inside the slot is not the fieldset's own `<legend>`, so the name is handed over as a reference.
    private readonly nameFromLegend = () => {
        const legend = this.querySelector<GeFieldLegend>(':scope > ge-field-legend');
        const fieldset = this.fieldset.value;
        if (fieldset) fieldset.ariaLabelledByElements = legend ? [legend] : null;
    };

    protected override render() {
        return html`<fieldset ${ref(this.fieldset)} part="set" data-slot="field-set"><slot @slotchange=${this.nameFromLegend}></slot></fieldset>`;
    }
}
