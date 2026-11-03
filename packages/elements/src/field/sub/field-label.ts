import { GeLabel } from '../../label/label.js';

/**
 * The label of a `ge-field`: a `ge-label` that also carries the field's slot name. Set `for` to the `id` of the
 * control; clicking the text focuses it and the control is named by it.
 *
 * @slot - The label text.
 * @attr {string} for - `id` of the control, looked up in the same tree as this element.
 */
export class GeFieldLabel extends GeLabel {
    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'field-label';
    }
}
