import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './field-group.css?inline';

/**
 * Spaces sibling fields evenly. Purely visual: use `ge-field-set` when the grouping should also be semantic.
 *
 * @slot - `ge-field`s.
 * @csspart group - The grid.
 */
export class GeFieldGroup extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'field-group-host';
    }

    protected override render() {
        return html`<div class="group" part="group" data-slot="field-group"><slot></slot></div>`;
    }
}
