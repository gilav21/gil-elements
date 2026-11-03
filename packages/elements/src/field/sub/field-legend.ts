import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './field-legend.css?inline';

let nextId = 0;

/**
 * The title of a `ge-field-set`. The set names itself from it, which a native `<legend>` could not do from
 * inside this element's shadow root.
 *
 * @slot - The legend text.
 */
export class GeFieldLegend extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'field-legend-host';
        this.id ||= `ge-field-legend-${++nextId}`;
    }

    protected override render() {
        return html`<legend data-slot="field-legend"><slot></slot></legend>`;
    }
}
