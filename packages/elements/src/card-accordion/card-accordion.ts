import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { GeAccordion } from '../accordion/accordion.js';
import css from './card-accordion.css?inline';

/**
 * An accordion whose items are elevated cards. It keeps the accordion's state engine (`type`, `value`,
 * `collapsible`, `change`) and adds a smooth height animation.
 *
 * @slot - `ge-card-accordion-item`s.
 * @fires change - After the user opens or closes an item; read `value`.
 * @cssprop --density-card-accordion - Spacing multiplier; falls back to `--density`.
 */
export class GeCardAccordion extends GeAccordion {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<div class="card-accordion" data-slot="card-accordion"><slot></slot></div>`;
    }
}
