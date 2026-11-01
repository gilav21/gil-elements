import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './timeline-title.css?inline';

/**
 * The event's name.
 *
 * @slot - The text.
 */
export class GeTimelineTitle extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<h4 part="base" data-slot="timeline-title"><slot></slot></h4>`;
    }
}
